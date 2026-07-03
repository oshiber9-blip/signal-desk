// api/chart.js
// 30-day daily closing prices for one ticker, used to draw the sparkline chart.
// Source: Stooq (free, no API key required, US daily EOD data).

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    const r = await fetch(`https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=d`);
    if (!r.ok) return res.status(r.status).json({ error: "Stooq error" });
    const text = await r.text();

    const lines = text.trim().split("\n").slice(1); // drop header row
    const rows = lines
      .map((line) => {
        const [date, , , , close] = line.split(",");
        return { date, close: parseFloat(close) };
      })
      .filter((row) => row.date && !isNaN(row.close));

    const recent = rows.slice(-30);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json(recent);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
}
