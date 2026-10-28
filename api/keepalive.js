// Vercel cron (daily): pings Supabase so a free project is not paused for inactivity.
// Uses the same public env vars as the website. Not a guarantee, but it counts as daily activity.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
  try {
    const r = await fetch(`${url}/rest/v1/app_settings?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.status(200).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
