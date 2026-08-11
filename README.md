# Philobrary

A curated digital library of philosophy essays, thinkers, and original research — translated into 15 languages.

## Features

- 15-language UI with automatic content translation (free Google Translate endpoint, no API key)
- Full-bleed Light/Dark themes (neutral grey dark mode)
- Markdown editor with Google Docs paste support
- Admin dashboard: create/edit/delete papers, schedule publishing, manage tags, per-paper SEO fields
- Auto-suggested SEO (meta description + keywords) from title, author, focus area, and content
- Public shareable paper URLs at `/p/:slug` with dynamic Open Graph + JSON-LD metadata
- Bookmarks, search, tag filters, sort options
- View counters and analytics

## Tech Stack

- React 19 + Vite + TypeScript
- Firebase Realtime Database + Firebase Auth
- Tailwind CSS v4
- react-router-dom

## Getting Started

```bash
npm install
npm run dev
```

## Environment

Create a `.env.local` (or set `APP_URL` for the public base URL used in SEO/citations):

```
APP_URL=https://philobrary.vercel.app
```

Firebase config lives in `src/firebase.ts` (client config; the apiKey is public by design).

## Deploy

- Database rules: `firebase deploy --only database` (requires `firebase login`)
- Frontend: `npm run build` then deploy the `dist/` folder (Vercel, Firebase Hosting, etc.)

## Admin

Only whitelisted emails (see `ADMIN_EMAILS` in `src/store.ts`) can write papers/tags. The app gated admin panel is at `/admin`.
