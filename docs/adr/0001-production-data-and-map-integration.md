# Use Supabase for the protected production data pipeline

The public HDB Pricing Map will ingest the official resale dataset into Supabase on a schedule and use OneMap from server-side services for authenticated place search and geocoding. Supabase's service-role key and the OneMap credentials stay server-side; this costs more than a static client-only map, but supports refreshes with a visible Data-Through Date and makes the public price experience dependable.
