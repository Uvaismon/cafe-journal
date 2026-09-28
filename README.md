# ☕ Café Journal

A sign-in-only café journal built as a static site for GitHub Pages, with Supabase Authentication, Postgres, and private Storage. Authenticated editors can read the shared journal and add/edit entries; only the approved account can delete.

## Architecture

- **Frontend:** HTML + CSS + vanilla JavaScript
- **Hosting:** GitHub Pages
- **Auth:** Supabase Auth (email/password)
- **Database:** Supabase Postgres
- **Access:** Sign-in required for all café data and photos; signups are disabled and accounts are created by an administrator
- **Security:** Postgres Row Level Security (RLS), private Storage bucket, authenticated reads
- **Cost:** designed for the free tiers

## Setup

### 1. Create a Supabase project

Create a free project at https://supabase.com/.

### 2. Create the tables and policies

For a new project, open **SQL Editor** in Supabase and run `schema.sql`. For the existing project that already has tables, run `private-access.sql` to replace its policies and make the photo bucket private; this keeps existing café and photo records.

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

Do not store café data in the GitHub repository. Café entries and images are stored in Supabase and require an authenticated session. Disable user signups and create editor accounts yourself. Never put a Supabase service role or secret key in `config.js`.

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
2. Keep the bucket **Private**. The SQL sets it private as well.
3. Run `private-access.sql` on an existing project to replace the old public-read policies. Do not make this bucket public.
4. Café images are downloaded through an authenticated Storage request and shown in the browser only while signed in.

Photo files are stored in Supabase, not in the GitHub repository.
