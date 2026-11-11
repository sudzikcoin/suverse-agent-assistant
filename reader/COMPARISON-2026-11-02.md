# The open reader vs SuVerse's stored cards — 10 sites, 2026-11-02

`versum-reader read <site> --no-share --no-model` (version 0.1.0) on the websites of 10 businesses in SuVerse's
catalogue, compared with the card SuVerse's analyzer stored for the same business. The stored card also has
Google's data (phone, opening hours), the ordering-platform menus the analyzer follows, PDF/image menus and the
fill agent; the reader has none of those by design.

| business (site) | family | items stored → reader | priced stored → reader | doors stored → reader | e-mail | phone | hours | time |
|---|---|---|---|---|---|---|---|---:|
| Shudh Vaishnu Dhaba (shudhvaishnudhaba.com) | food | 75 → 0 | 75 → 0 | order → — | – / – | ✓ / – | ✓ / – | 5 s |
| Armature Works (armatureworks.com) | food | 1 → 0 | 1 → 0 | — → book, order | ✓ / – | ✓ / – | ✓ / – | 3 s |
| Mocotó Vila Medeiros (mocoto.com.br) | food | 25 → 0 | 25 → 0 | reserve → — | ✓ / ✓ | ✓ / – | ✓ / – | 33 s |
| Blackbird Floral (blackbirdfloral.com) | florist | 30 → 72 | 30 → 71 | order → order | – / – | ✓ / ✓ | – / ✓ | 10 s |
| Flowers of Miami (flowersofmiami.net) | florist | 176 → 237 | 176 → 176 | order → order | – / ✓ | ✓ / ✓ | – / – | 13 s |
| Paradise Caps (paradisecaps.com) | shop | 500 → 496 | 500 → 496 | order → order | – / – | – / – | – / – | 13 s |
| Busch Nails and Lashes (buschnails.com) | booking | 6 → 6 | 6 → 6 | book, order → order | – / – | ✓ / ✓ | ✓ / ✓ | 9 s |
| NiNi Nails Salon & Spa (nininails.com) | booking | 68 → 68 | 68 → 68 | book → book | ✓ / ✓ | ✓ / – | ✓ / – | 23 s |
| Acree Plumbing, Air & Electric (trustacree.com) | quote | 7 → 4 | 0 → 0 | book, request_quote → book, request_quote | – / – | ✓ / ✓ | ✓ / – | 8 s |
| And Services (andservices.com) | quote | 1 → 1 | 0 → 1 | book, request_quote → — | – / – | ✓ / ✓ | ✓ / – | 212 s |

E-mail / phone / hours columns: stored / reader.

## What the differences are

- **Shops and booking: the same or more.** Paradise Caps 496 of 500 (the analyzer caps at 500; four lines were
  dropped by the item filter), NiNi Nails 68/68, Busch Nails 6/6. Blackbird Floral and Flowers of Miami: the reader
  read the whole Squarespace/WooCommerce catalogue today (72 and 237 items) where the stored cards are older.
  Flowers of Miami's 61 unpriced items are catalogue entries with no price in the shop's own answer.
- **Food: the reader misses what the analyzer reads off the site.** Shudh Vaishnu Dhaba's 75 dishes come from its
  ordering platform's menu page, which the analyzer follows and the reader does not yet; Mocotó's menu is a
  document (PDF) the analyzer reads and the reader does not; Armature Works is a food hall whose stored card has
  one item. Next step for the reader: the ordering-platform menu fallback and the PDF menu reader.
- **Phone and hours: Google's.** Most stored phones and hours come from Google; the reader only has what the site
  states (tel: links, schema.org), so these columns are expected to differ.
- **Doors.** Busch Nails' stored `book` door comes from the analyzer's platform-site reading; the reader saw the
  shop's cart only. And Services: the reader found no quote door because its home page does not name the trade
  (the reader keeps a quote form as a `request_quote` door only when the site names a trade or lists services —
  without that rule two shops got a «request a quote» door from their contact forms).
- **Time.** And Services asks for a 10-second crawl delay in robots.txt; the reader honours it, hence 212 s.

Nothing in the reader's cards above was invented: every item and door carries the page it was read from.
