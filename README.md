# HDB Field Map

HDB Field Map helps you look past a single headline price and understand what resale flats nearby have actually sold for.

Start with the map, choose an area you are considering, then open a block to see the recent sales behind its price marker. It is designed for people comparing places to live—not for property speculation or a one-number valuation.

## What you can do here

- Browse recent HDB resale evidence across Singapore.
- Compare blocks using **price per square foot**, which makes differently sized flats easier to compare fairly.
- Open a block to see its recent sales: registration month, flat type, floor area, storey range, lease commencement year, total sale price, and price per square foot.
- Search for a block, street, town, or Singapore place to move the map to an area you know.
- See the latest month included in the data, so you know how current the picture is.

The initial map view focuses on **4-room flats sold in the most recent 12 months**. Use the flat-type selector to compare every flat type supplied by the HDB dataset, one type at a time. That keeps every marker comparable with the others around it.

## How to read the map

Each coloured dot represents one HDB block. Its colour is based on the block's **median price per square foot** for the matching recent sales.

| Colour | What it means |
| --- | --- |
| Teal | Under $560/sq ft |
| Gold | $560–$650/sq ft |
| Orange | $650–$745/sq ft |
| Red | $745/sq ft and above |

The ranges are fixed. A gold dot means the same thing whether you are looking at one town or the whole island.

When you select a dot, the side panel shows both the block-level median and the individual resale transactions that produced it. Use those individual sales as the evidence; the colour is there to help you spot patterns quickly.

## A quick example

Imagine two 4-room flats both sold for $650,000. One is 93 sqm (about 1,001 sq ft) and the other is 110 sqm (about 1,184 sq ft). Their total prices match, but their price per square foot does not:

```text
$650,000 ÷ 1,001 sq ft = about $649/sq ft
$650,000 ÷ 1,184 sq ft = about $549/sq ft
```

That is why the map starts with price per square foot, while still showing the total sale price in the block details. HDB supplies floor areas in square metres, so the app converts those source values for display.

## Where the information comes from

Sale records come from HDB's official [Resale flat prices based on registration date from Jan-2017 onwards](https://data.gov.sg/datasets?topics=housing&resultId=d_8b84c4ee58e3cfc0ece0d773c8ca6abc) dataset on data.gov.sg.

OneMap provides the Singapore basemap and converts each HDB block address into a map location. The app stores a block's latitude and longitude, not an individual home's location.

## Important limits

This is resale evidence, **not a valuation or a recommendation to buy**. Two homes in the same block can sell for very different prices because of condition, renovation, floor, orientation, remaining lease, timing, and buyer/seller circumstances.

Some blocks may have no sale matching the current period. In that case, the honest answer is “no matching recent transactions”—the map does not invent an estimate.

The source data excludes some transactions that may not represent a full market price, such as sales between relatives or transfers of part shares. Prices should still be treated as indicative.

## Keeping the map current

The importer checks the official dataset's newest registration month before doing any heavy work. If no newer data is available, it skips re-downloading the full transaction history and continues only with any unfinished map-location work. New block locations are cached, so OneMap is normally called once per block/street combination.

## Running a copy of the project

The site can run in clearly labelled demo mode without credentials:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

For a live copy, create a Supabase project and a OneMap account. Add the Supabase project URL, publishable key, server-only service-role key, and OneMap credentials to `.env.local`. Never put the service-role key or OneMap password in browser code.

Apply the database migrations, then import the data:

```bash
pnpm supabase init
pnpm supabase login
pnpm supabase link --project-ref vnhofezqotyahwbqgkqo
pnpm supabase db push
pnpm ingest
```

The migrations and their purpose are kept in [supabase/migrations](./supabase/migrations). Product terms and the decisions behind the experience live in [CONTEXT.md](./CONTEXT.md) and [docs/adr](./docs/adr).
