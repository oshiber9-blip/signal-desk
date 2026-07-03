// api/chart.js
// 30-day daily closing prices for one ticker, used to draw the sparkline chart.
// Source: Yahoo Finance's public chart endpoint (free, no API key required).

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      { headers: { "User-Agent": BROWSER_UA } }
    );
    const data = await r.json();
    const result = data?.chart?.result?.[0];

    if (result) {
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const rows = timestamps
        .map((t, i) => ({
          date: new Date(t * 1000).toISOString().slice(0, 10),
          close: closes[i],
        }))
        .filter((row) => row.close != null);

      if (rows.length > 1) {
        res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
        return res.status(200).json(rows.slice(-30));
      }
    }

    return res.status(200).json([]);
  } catch (e) {
    return res.status(200).json([]);
  }
}
