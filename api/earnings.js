// api/earnings.js
// Live earnings calendar for the next 30 days, used to power the Planner tab.
// Vercel env var required: FINNHUB_KEY

export default async function handler(req, res) {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`
    );
    if (!r.ok) return res.status(r.status).json({ error: "Finnhub error" });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json(data.earningsCalendar || []);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch earnings calendar" });
  }
}
