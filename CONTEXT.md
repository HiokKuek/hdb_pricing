# HDB Pricing Map — Ubiquitous Language

## Terms

**Buyer** — A person using the product to discover areas within their budget and assess comparable HDB resale transactions nearby.

**HDB Pricing Map** — The public web application that presents HDB resale-price information geographically for Buyers.

**Resale Transaction** — One recorded HDB resale sale from the HDB dataset. It has a registration month, flat characteristics, address components, and agreed resale price; it is indicative rather than a valuation.

**Comparable Transaction** — A Resale Transaction selected as relevant to a Buyer's search based on its location, recency, and flat characteristics. The precise comparison rules are not yet decided.

**Block Price Summary** — The aggregate of Resale Transactions associated with one HDB block. On the map, a Block Price Summary is located at the block address and exposes its individual recent transactions when selected.

**Comparable Price** — The median resale price per square foot of the Resale Transactions included in a Block Price Summary. It is the primary colour scale for the map; median total resale price is supporting detail. The app derives it from HDB's metric source values for display.

**Data-Through Date** — The latest registration month represented by the HDB data currently published in the HDB Pricing Map. The application displays it so Buyers can judge freshness.

**Public Explorer** — The unauthenticated version of the HDB Pricing Map. It does not retain accounts, saved searches, or favourites.

**Buyer Filters** — The controls a Buyer uses to define Comparability: flat type, budget, floor area, remaining lease, and transaction recency. A selection applies across the whole map, including later pans, without changing the Buyer's current map position or zoom. The first release actively filters by every flat type supplied by HDB; storey range is displayed as Transaction Detail rather than used as a first-release filter.

**Place Search** — A OneMap-backed navigation control that lets a Buyer fly the map to an address, MRT station, or other Singapore place at a consistent detail level. It does not filter map markers or change Buyer Filters.

**Indicative Price Notice** — The clear statement that resale prices are transaction records, not valuations, and vary with factors not fully represented in the map. It appears beside price information and is expanded in the footer with source information.

**Default Market Lens** — The initial comparison shown to a Buyer: all flat types registered in the last 12 months, without a floor-area or remaining-lease restriction. Buyers can refine the results through Buyer Filters.

**Map Colour Scale** — The restrained visual scale that represents Comparable Price. It supports geographic comparison without presenting a price as a valuation or recommendation.

**Price Band** — A fixed, labelled price-per-square-foot range in the Map Colour Scale. A block keeps the same band meaning as the Buyer pans or changes filters.

**Transaction Detail** — The evidence shown after a Buyer selects a block: its recent Resale Transactions with month, flat type, floor area in square feet, storey range, lease commencement year, total sale price, and price per square foot. It closes when a Buyer changes any Buyer Filter.

**No-Match State** — The honest result when a block or filter selection has no qualifying Resale Transactions. When an active Buyer Filter has matches elsewhere but none in the current map view, it appears as a small dismissible toast for about five seconds that encourages the Buyer to pan or search another location. It offers a broader recency window and never substitutes an estimate.
