// api/quote.js
// Live price quote for one ticker. Keeps the Finnhub key server-side.
// Vercel env var required: FINNHUB_KEY

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_KEY}`
    );
    if (!r.ok) return res.status(r.status).json({ error: "Finnhub error" });
    const data = await r.json();
    // data: { c: current, d: change, dp: percent change, h: high, l: low, o: open, pc: prev close }
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch quote" });
  }
}
