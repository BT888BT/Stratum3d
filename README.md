# Stratum3D

Production-ready starter for 3D print quotes and orders.

## Stack
- Next.js
- Supabase
- Stripe
- Vercel

## Required environment variables

See `.env.example`

## Supabase setup
1. Create a new Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Create a **private** storage bucket called `order-files`

## Stripe setup
1. Get test API keys
2. Add them in Vercel environment variables
3. Add webhook endpoint:
   `https://YOUR_DOMAIN/api/stripe/webhook`
4. Subscribe to:
   - `checkout.session.completed`

## Vercel setup
1. Create GitHub repo
2. Import repo into Vercel
3. Add environment variables
4. Deploy

## Notes
- Version 1 pricing uses user-entered approximate dimensions
- STL geometry parsing can be added later
- Admin pages currently use service-role backed server access, so protect deployment access appropriately before going live
