# CoCharge — P2P EV Charging Marketplace

A peer-to-peer electric vehicle (EV) charging marketplace that connects EV drivers with people offering private charging stations.

Built with Next.js, TypeScript, Supabase, Razorpay and Mapbox.

## Features

- **Map & Discovery:** Mapbox-powered map with charging station locations and nearby station discovery.
- **Station Details:** Connector types, charging rates, amenities and availability slots.
- **Booking Flow:** Slot reservations and Razorpay payment integration.
- **Driver Dashboard:** View bookings and track booking status.
- **Live Sessions:** Real-time charging session monitoring using Supabase Realtime. Charging data is simulated for the prototype.
- **Host Dashboard:** Manage charging stations, availability slots and bookings.
- **Authentication:** Supabase authentication with Google OAuth and email.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend & Database:** Supabase (Authentication, PostgreSQL, Row Level Security and Realtime)
- **Payments:** Razorpay
- **Maps:** Mapbox
- **State & Data Management:** TanStack Query, Zustand
- **Forms & Validation:** React Hook Form, Zod
- **UI Components:** Radix UI

## Getting Started

### 1. Clone the repository

```bash
git clone <your-cocharge-repository-url>
cd CoCharge
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the required credentials for:

- Supabase URL and publishable/anonymous key
- Supabase service-role key (server-side only)
- Mapbox access token
- Razorpay Key ID and Key Secret
- Resend API key, if email functionality is enabled
- UploadThing credentials, if file uploads are enabled

Never commit `.env.local` or expose secret keys in client-side code.

### 4. Apply database migrations

```bash
pnpm exec supabase db push
```

Make sure your Supabase project is linked and the required migrations are available before running this command.

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` — Next.js App Router pages, layouts and API routes
- `components/` — UI components, maps, stations, host and session modules
- `hooks/` — Custom React hooks
- `lib/` — Supabase clients, validations and utilities
- `supabase/` — Database migrations and Edge Functions
- `types/` — Shared TypeScript types
- `scripts/` — Development and setup scripts

## Payment Testing

CoCharge currently uses Razorpay Test Mode for payment testing.

Use Razorpay test credentials during local development. Do not use live payment credentials until payment verification, webhook handling and recovery workflows have been tested.

## Project Status

CoCharge is an academic software prototype. Charging session measurements are simulated and are not connected to physical EV charging hardware.

## Contributing

Contributions and suggestions are welcome. Please ensure changes are tested before submitting them.
