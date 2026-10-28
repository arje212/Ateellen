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


---

# Go-live checklist

## SQL — run in this order (SQL Editor → New query → Run)
1. `schema.sql` → 2. `seed.sql` → 3. `admin_only.sql` → 4. `tracking_addons.sql` → 5. **`go_live.sql`**
(If you start from scratch, `schema.sql` already contains everything except `seed.sql`.)

## What each feature needs
| Feature | Where to control it |
|---|---|
| Open / Closed switch | Green/red pill at the top of the admin, or Settings. Optional automatic hours in Settings. |
| Sold out | Admin → Menu → **Sold out** button on each dish |
| Delivery fee / min order / areas | Settings |
| GCash / Maya | Settings → fill in number (+ QR link). Customer pays, enters the reference number; you check it, then **Orders → Mark as Paid** |
| Customer cancel | Tracking page (only while the order is still "New") |
| Inventory auto-deduct | Menu → edit a dish → *Ingredients used per serving*. Stock is deducted when the kitchen presses **Start** |
| Cashier account | Supabase → Authentication → Users → Add user, then Admin → **Users & Roles** → set role `cashier` |
| Backup | Settings → Backup & Export (do this weekly) |
| New-order alerts | Admin → click **🔔 Enable alerts** once. Keep the admin/kitchen page open |

## Security notes
- Online orders are re-priced **on the server**; customers cannot change prices, delivery fee or order number.
- Limits: 5 orders / hour per phone number, 60 online orders / 10 min overall.
- Visitors can never read the orders table. Tracking works only with the secret link or order number + phone.

## Supabase free plan
- A free project is **paused after ~1 week without activity**. `api/keepalive.js` + the daily cron in `vercel.json` pings it every day (works on Vercel; it needs the same two env vars). For a real business, consider the Pro plan (daily backups, no pausing).

## Custom domain (e.g. daddyssizzlers.com)
1. Buy the domain (Namecheap, GoDaddy, etc.).
2. Vercel → your project → **Settings → Domains → Add** → follow the DNS records it shows.
3. Supabase → Authentication → URL Configuration: set **Site URL** + add `https://yourdomain.com/**` to Redirect URLs.
4. In `index.html`, replace `https://daddyskitchenette.vercel.app` in the `og:` tags with your new domain, and replace `public/og-image.png` with your own banner if you like.
