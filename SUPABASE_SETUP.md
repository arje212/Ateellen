# Supabase setup (Daddy's Sizzlers / Ateellen)

The app now runs on **Supabase** (Postgres + Auth + Realtime) instead of Base44.

## 1. Create the database (one time)
Supabase Dashboard → **SQL Editor** → New query:
1. Paste **`supabase/schema.sql`** → Run.
2. Paste **`supabase/seed.sql`** → Run (your 6 categories, 32 products and restaurant settings).

## 2. Environment variables
Local: copy `.env.example` → `.env` (already filled in for you).
Vercel: Project → Settings → Environment Variables, add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.

## 3. Auth settings (Supabase → Authentication)
- **URL Configuration** → Site URL = your Vercel URL; add `http://localhost:1736/**` and `https://YOUR-APP.vercel.app/**` to Redirect URLs (needed for password reset + Google login).
- **Sign In / Providers → Email**: either turn **"Confirm email" OFF** (simplest — users get in right after signing up), or keep it ON and edit
  *Email Templates → Confirm signup* to include the 6-digit code: `Your code is {{ .Token }}` (the Register page asks for that code).
- Google login (optional): enable the Google provider and paste your OAuth client id/secret.

## 4. First login
**Register the first account at `/register` — it automatically becomes the admin.**
Everyone after that is `pending` (sees an "Waiting for approval" screen and has no data access) until an admin:
- approves them in **Admin → Users & Roles** (change role from `pending` to `user`/`admin`), or
- pre-approves their email with **Invite User** (they get that role when they sign up).

## Roles
| role | access |
|---|---|
| `admin` | everything + manage users |
| `user` | all dashboard/POS/kitchen data, can't manage users |
| `pending` | nothing (waiting for approval) |
| not logged in | public landing page, menu, and placing an online order only |
