# HKJC Horse Viewer

A static single-page web app (hosted on **GitHub Pages**) that displays Hong Kong Jockey Club (HKJC) local race results with per-horse analytics.

## Features

- Displays race results fetched directly from the [hkjc_scraper](https://github.com/mzf3334-dev/hkjc_scraper) data repository
- Date selector to browse all available race days
- Per-horse analytics computed client-side from historical data:
  - **跑位** — Typical running position (前 front / 中 mid / 後 back)
  - **騎配** — Jockey–horse partnership record (wins / total rides together)
- Finishing position badges coloured gold (1st), silver (2nd), bronze (3rd), red (PU)
- Responsive layout: two-panel on desktop, stacked on mobile

## Data Source

Race results are read from CSV files in the `mzf3334-dev/hkjc_scraper` repository via the GitHub Contents API:

```
GET https://api.github.com/repos/mzf3334-dev/hkjc_horse_viewer/contents/data
```

Each CSV is fetched from:

```
https://raw.githubusercontent.com/mzf3334-dev/hkjc_scraper/main/data/hkjc_results_YYYYMMDD.csv
```

No backend or build step is required — all processing happens in the browser.

## CSV Column Schema

See the [hkjc_scraper README](https://github.com/mzf3334-dev/hkjc_scraper#output-format) for the full column schema.

## Analytics

### Running Position (跑位)

Determined by parsing the `賽後馬匹狀況` (post-race incident) field for keywords:

| Keywords | Classification |
|----------|---------------|
| 領放, 居前列, 前列位置 | 前 (front) |
| 在馬群之後, 後列, 居後 | 後 (back) |
| Fallback: gate number 1–4 / 5–8 / 9+ | 前 / 中 / 後 |

The most frequent classification across all historical races is shown.

### Jockey–Horse Record (騎配)

Counts how many times the current jockey has won on this horse vs total rides together, across all loaded historical CSVs.

| Result | Badge colour |
|--------|-------------|
| First time together (首次) | Green |
| 0 wins | Blue |
| ≥ 1 win | Red |

## Development

The app is a single HTML file (`prototype.html` / `index.html`) with embedded CSS and JavaScript — no build tools or dependencies needed.

To run locally, open `prototype.html` directly in a browser (note: GitHub API calls may require a local server to avoid CORS issues):

```bash
python -m http.server 8080
# then open http://localhost:8080/prototype.html
```

## Related

- [hkjc_scraper](https://github.com/mzf3334-dev/hkjc_scraper) — Python scraper that produces the CSV data files
