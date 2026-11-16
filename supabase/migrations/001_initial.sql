-- CoCharge: P2P EV Charging Marketplace - Initial Schema
-- Run with: supabase db push

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'host', 'admin')),
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stations


-- Slots
CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'charging', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slots_station ON slots(station_id);
CREATE INDEX idx_slots_time ON slots(start_time, end_time);
CREATE INDEX idx_slots_status ON slots(status);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL DEFAULT 0,
  kwh_delivered FLOAT4,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);
CREATE INDEX idx_bookings_station ON bookings(station_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_station ON reviews(station_id);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);

-- Charging sessions (realtime)
CREATE TABLE charging_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  current_kw FLOAT4 NOT NULL DEFAULT 0,
  kwh_delivered FLOAT4 NOT NULL DEFAULT 0,
  battery_percent INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initializing' CHECK (status IN ('initializing', 'charging', 'paused', 'completed', 'error')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charging_sessions_booking ON charging_sessions(booking_id);

-- Enable Realtime for charging_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE charging_sessions;

-- RLS Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE charging_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Stations: public read, host CRUD own
CREATE POLICY "Stations are viewable by everyone" ON stations
  FOR SELECT USING (true);

CREATE POLICY "Hosts can insert own stations" ON stations
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own stations" ON stations
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own stations" ON stations
  FOR DELETE USING (auth.uid() = host_id);

-- Slots: public read, host manage own
CREATE POLICY "Slots are viewable by everyone" ON slots
  FOR SELECT USING (true);

CREATE POLICY "Hosts can manage slots for own stations" ON slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stations
      WHERE stations.id = slots.station_id AND stations.host_id = auth.uid()
    )
  );

-- Bookings: drivers see own, hosts see for their stations
CREATE POLICY "Drivers can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Hosts can view bookings for their stations" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stations
      WHERE stations.id = bookings.station_id AND stations.host_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can create bookings" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "System can update booking status" ON bookings
  FOR UPDATE USING (
    auth.uid() = driver_id OR
    EXISTS (SELECT 1 FROM stations WHERE stations.id = bookings.station_id AND stations.host_id = auth.uid())
  );

-- Reviews: public read, drivers create for own completed bookings
CREATE POLICY "Reviews are viewable by everyone" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Drivers can create reviews for own bookings" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = driver_id AND
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.driver_id = auth.uid() AND bookings.status = 'completed')
  );

-- Charging sessions: drivers and hosts can read
CREATE POLICY "Charging sessions viewable by booking parties" ON charging_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = charging_sessions.booking_id AND b.driver_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM bookings b JOIN stations s ON s.id = b.station_id WHERE b.id = charging_sessions.booking_id AND s.host_id = auth.uid())
  );

CREATE POLICY "Hosts can manage charging sessions" ON charging_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookings b JOIN stations s ON s.id = b.station_id
      WHERE b.id = charging_sessions.booking_id AND s.host_id = auth.uid()
    )
  );

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  connector_types TEXT[] NOT NULL DEFAULT '{}',
  power_kw FLOAT8 NOT NULL,
  price_per_kwh NUMERIC(6,4) NOT NULL,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  avg_rating FLOAT4 DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_host ON stations(host_id);
CREATE INDEX idx_stations_status ON stations(status);
CREATE INDEX idx_stations_location ON stations(latitude, longitude);
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed data