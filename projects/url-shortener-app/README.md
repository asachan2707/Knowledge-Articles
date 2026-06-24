# URL Shortener App

This is a runnable demo project for the `Learning` URL shortener topic. It includes:

- a React frontend
- a Node/Express backend
- seeded in-memory data
- automatic frontend fallback to mock data when the backend is not running

## Project Structure

- `frontend/` - React app built with Vite
- `backend/` - Node/Express API with in-memory storage

## Run the App

From `Learning/projects/url-shortener-app`:

```bash
npm run setup
npm run dev
```

Or run each side independently:

```bash
npm run dev:backend
npm run dev:frontend
```

## Ports

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Demo Modes

- If the backend is running, the frontend uses the live API.
- If the backend is not available, the frontend automatically switches to seeded mock data and shows a demo-mode banner.

## Supported Demo Features

- Create a short URL
- View recent short URLs
- Open a short URL
- Inspect per-link analytics
- See total links and click counts
