# ☕ Café Journal

A publicly viewable café journal built as a static site for GitHub Pages, with Supabase Authentication + Postgres. Anyone can browse entries; only administrator-created editor accounts can add, edit, or delete entries.

## Architecture

- **Frontend:** HTML + CSS + vanilla JavaScript
- **Hosting:** GitHub Pages
- **Auth:** Supabase Auth (email/password)
- **Database:** Supabase Postgres
- **Access:** Public read-only browsing; authenticated editor accounts can write
- **Security:** Postgres Row Level Security (RLS); public café details and photos are visible to anyone
- **Cost:** designed for the free tiers

## Setup

### 1. Create a Supabase project

Create a free project at https://supabase.com/.

### 2. Create the table

Open **SQL Editor** in Supabase and run the contents of `schema.sql`.

### 3. Configure editor accounts

In Supabase:
- Authentication → Providers → Email: enable Email/password sign-in and disable new user signups.
- Create each permitted editor account yourself in Authentication → Users (or invite them from the dashboard).
- Add your GitHub Pages URL under Authentication → URL Configuration → Redirect URLs.

Example:

`https://YOUR-GITHUB-USERNAME.github.io/cafe-journal/`

### 4. Configure the frontend

Copy `config.example.js` to `config.js` and put your Supabase project URL and browser publishable/anon key in it.

The browser key is intended for client-side use. **Never use a Supabase service_role/secret key here.** RLS is what protects the database.

### 5. Push to GitHub

Create a repository, for example:

`cafe-journal`

Put all files in the repository and push to `main`.

### 6. Enable GitHub Pages

GitHub → repository → Settings → Pages → Source → **GitHub Actions**.

The included workflow will deploy on every push to `main`.

Your URL will look like:

`https://YOUR-GITHUB-USERNAME.github.io/cafe-journal/`

## Important security note

Do not store café data in the GitHub repository. Café entries are stored in Supabase and intentionally readable by anyone. Only signed-in editor accounts can write through the app; disable user signups in Supabase and create editor accounts yourself. Never put a Supabase service role or secret key in `config.js`.

`config.js` contains a browser-safe Supabase publishable/anon key, not a secret. If you use an older Supabase project with an `anon` key, that is also the client-side key.

## Features

- Admin-managed editor sign-in (public sign-up is disabled)
- Persistent sessions
- Add, edit and delete cafés
- Coffee / food / ambience / Wi-Fi ratings
- Automatic overall rating
- Favourite cafés
- Revisit status
- Search
- Vibe filter
- Rating filter
- Spend tracking
- Responsive mobile layout
- Dashboard statistics


## Photo storage

The café photo feature uses **Supabase Storage**, not GitHub.

In Supabase Storage:
1. Create a bucket named `cafe-photos`.
2. Make it **Public** so visitors can view journal photos without signing in. Anyone with a photo URL can view that image.
3. Run the latest `schema.sql` so the storage RLS policies are created.
4. The site uploads photos after an editor signs in.

Photo files are stored in Supabase, not in the GitHub repository.
