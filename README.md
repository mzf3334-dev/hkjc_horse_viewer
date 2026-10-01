# HKJC Horse Viewer

A lightweight browser app for exploring Hong Kong horse race cards and historical results.

## Features

- Browse the current race card and inspect each runner's jockey, trainer, draw, weight, recent form, and running position.
- Compare two top-four prediction panels: a simple weighted-score baseline and GLM 5.3 Insight.
- View estimated win and top-three probabilities, the predicted top-four order, and the strongest contributing factors.
- Use the responsive interface on desktop or mobile.

## Prediction Models

- **Weighted Score:** A transparent heuristic using recent finishing positions, same-distance results, jockey and jockey-trainer win rates, and an inside-draw adjustment for sprint races.
- **GLM 5.3 Insight:** An independent model that does not use the weighted-score output. It builds walk-forward, opponent-adjusted online horse ratings and 21 race-specific features from historical results. Feature weights are fit with a regularized conditional Plackett-Luce win objective. The model returns relative win probabilities, estimates top-three probabilities, and displays its four highest-ranked runners.

### Training and Validation

The checked-in model was trained from 941 historical races in `all_results.csv`. The chronological evaluation used 601 races to fit coefficients, 151 subsequent races to select regularization, and a final untouched holdout of 189 later races. On that holdout, the top-ranked selection won 27.5% of races and a winner appeared in the predicted top four in 63.0% of races. Random-selection baselines were 8.2% and 32.6%, respectively. Ratings, draw adjustments, jockey/trainer baselines, and feature scaling use only information available before the target date or training split.

This is a small, single-circuit historical evaluation, not evidence of guaranteed future performance. Treat all probabilities and rankings as estimates; race results are uncertain.

To retrain the model with Node.js 18 or newer:

```bash
node tools/train_glm.js [path/to/all_results.csv]
```

The trainer reads the feature implementation directly from `index.html`, evaluates a chronological validation period, then prints the normalization values and learned coefficients for deployment. The default CSV path expects the sibling `hkjc_scraper` repository. To smoke-test the embedded model:

```bash
node tools/smoke_glm.js [path/to/all_results.csv]
```

## Data

The app loads race cards and historical results from the [hkjc_scraper](https://github.com/mzf3334-dev/hkjc_scraper) project. An internet connection is required. The app has no backend or build step.

## Run Locally

From this folder, start a local web server:

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.
