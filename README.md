# Air Beats Live Music

Air Beats is a static music search and playback website. It searches public Invidious endpoints for YouTube music results and plays tracks through the YouTube iframe player.

## Run Locally

```bash
npm start
```

Open `http://localhost:5174`.

The local server also provides `/api/search` and `/api/suggest` proxy endpoints so search works more reliably during local development.

## Features

- Real-time search while typing
- YouTube music playback
- Queue, shuffle, repeat, previous, next, volume, and seek controls
- Grid/list results
- Infinite scroll for more results
- Static GitHub Pages workflow included
