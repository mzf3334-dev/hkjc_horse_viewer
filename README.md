# HKJC Horse Viewer

A lightweight web app for viewing and analyzing Hong Kong horse races.

## Features

- Browse the latest race card and select a race to inspect its runners.
- Compare four prediction panels, each using a different scoring method.
- Review the factors behind each model's leading selections.
- Use the responsive interface on desktop or mobile.

## Prediction Models

The four panels are intended to offer different views of the same field:

- **Weighted Score (加權評分):** A straightforward weighted score based on each horse's recent finishing positions and same-distance results, plus jockey and jockey-trainer win rates. It also gives an inside-draw advantage in sprint races.
- **WOE Bayesian Probability (WOE 貝氏機率模型):** Uses weight-of-evidence values with smoothed historical rates. Factors include recent form, distance, going, jockey and trainer records, horse-jockey and jockey-trainer combinations, weight, apprentice claims, draw, and running-style fit. It converts the combined score into relative win probabilities for the field.
- **Actuarial Credibility & Speed (精算信度速度模型):** Compares past race times with distance- and going-specific benchmarks, discounts older runs, and shrinks estimates when a horse or person has limited history. It combines speed and form with jockey, trainer and partnership records, weight, draw, and consistency before estimating win probabilities.
- **Grok4.7 玄機對弈:** Evaluates beaten lengths in the context of each past field, adjusting for weight, draw, and trouble noted during a run. It then matches runners against today's field using recent form, pace, head-to-head results, actual carried weight after apprentice claims, jockey changes, and other race conditions. It shows estimated win and place chances, plus badges for selections shared with or distinct from the other three panels.

Each model has different assumptions. Treat its rankings and probabilities as estimates, not guaranteed results.

## Data

The app loads the latest race card and historical results from the [hkjc_scraper](https://github.com/mzf3334-dev/hkjc_scraper) project. An internet connection is required. No backend or build tools are needed.

## Run Locally

From this folder, start a local web server:

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.
