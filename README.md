# HKJC Horse Viewer

A simple web app for viewing and analyzing upcoming Hong Kong horse races.

## Features

- View the latest race card and select a race.
- See horse rankings and analysis based on past race results.
- Use the app on desktop or mobile.

## Data

The app loads the latest race card and historical results from the [hkjc_scraper](https://github.com/mzf3334-dev/hkjc_scraper) project. It needs an internet connection. No backend or build tools are required.

## Run Locally

From this folder, start a local web server:

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.
