# web-activator-ai

Minimal two-step activation website for ChatGPT/Claude keys using Suppy.Redeem API.

## Features

- Step 1: Validate activation code.
- Step 2: Submit session/token or email (depends on key type).
- Poll activation status for personal keys.
- Black-and-white minimal UI.

## Run locally

```bash
npm install
npm run start
```

Open `http://localhost:3000`.

## API proxy routes

- `GET /api/key/:code`
- `POST /api/activate-session`
- `POST /api/activate-team`
- `GET /api/activation-status/:code`

Backend forwards requests to `https://redeem.suppy.org/api`.
