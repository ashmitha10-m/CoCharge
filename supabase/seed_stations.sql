
INSERT INTO public.stations (
  host_id,
  name,
  description,
  latitude,
  longitude,
  address,
  city,
  state,
  zip,
  connector_types,
  power_kw,
  price_per_kwh,
  amenities,
  photos,
  status
)
VALUES
(
  'a303fb41-de7f-42e9-a18d-3d8d69e07d99',
  'CoCharge Koramangala',
  'Simulated residential EV charging station',
  12.9352, 77.6245,
  'Koramangala', 'Bengaluru', 'Karnataka', '560034',
  ARRAY['CCS2', 'Type 2'],
  7.4, 12.00,
  ARRAY['wifi', 'parking'],
  ARRAY[]::TEXT[],
  'active'
),
(
  'a303fb41-de7f-42e9-a18d-3d8d69e07d99',
  'CoCharge Indiranagar',
  'Simulated residential EV charging station',
  12.9784, 77.6408,
  'Indiranagar', 'Bengaluru', 'Karnataka', '560038',
  ARRAY['CCS2', 'Type 2'],
  11.0, 13.00,
  ARRAY['wifi', 'parking', 'coffee'],
  ARRAY[]::TEXT[],
  'active'
),
(
  'a303fb41-de7f-42e9-a18d-3d8d69e07d99',
  'CoCharge HSR Layout',
  'Simulated residential EV charging station',
  12.9116, 77.6474,
  'HSR Layout', 'Bengaluru', 'Karnataka', '560102',
  ARRAY['CCS2', 'Type 2'],
  7.4, 11.50,
  ARRAY['wifi', 'restroom', 'parking'],
  ARRAY[]::TEXT[],
  'active'
),
(
  'a303fb41-de7f-42e9-a18d-3d8d69e07d99',
  'CoCharge BTM Layout',
  'Simulated residential EV charging station',
  12.9166, 77.6101,
  'BTM Layout', 'Bengaluru', 'Karnataka', '560076',
  ARRAY['CCS2', 'Type 2'],
  7.4, 12.50,
  ARRAY['parking', 'shelter'],
  ARRAY[]::TEXT[],
  'active'
),
(
  'a303fb41-de7f-42e9-a18d-3d8d69e07d99',
  'CoCharge Jayanagar',
  'Simulated residential EV charging station',
  12.9250, 77.5838,
  'Jayanagar', 'Bengaluru', 'Karnataka', '560041',
  ARRAY['CCS2', 'Type 2'],
  22.0, 14.00,
  ARRAY['wifi', 'parking', 'restaurant'],
  ARRAY[]::TEXT[],
  'active'
);
