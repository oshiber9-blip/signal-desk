// api/chart.js
// 30-day daily closing prices for one ticker, used to draw the sparkline chart.
// Primary source: Stooq (free, no key, but blocks requests without a normal
// browser User-Agent header). Falls back to Finnhub's candle endpoint if
// Stooq doesn't return usable data.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  try {
    // --- Try Stooq first ---
    const stooqRes = await fetch(`https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=d`, {
      headers: { "User-Agent": BROWSER_UA },
    });
    const text = await stooqRes.text();

    if (stooqRes.ok && text.includes(",")) {
      const lines = text.trim().split("\n").slice(1);
      const rows = lines
        .map((line) => {
          const [date, , , , close] = line.split(",");
          return { date, close: parseFloat(close) };
        })
        .filter((row) => row.date && !isNaN(row.close));

      if (rows.length > 1) {
        res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
        return res.status(200).json(rows.slice(-30));
      }
    }

    // --- Fallback: Finnhub daily candles ---
    const to = Math.floor(Date.now() / 1000);
    const from = to - 45 * 24 * 60 * 60;
    const fhRes = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`
    );
    const fhData = await fhRes.json();

    if (fhData.s === "ok" && Array.isArray(fhData.c)) {
      const rows = fhData.t.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: fhData.c[i],
      }));
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
      return res.status(200).json(rows.slice(-30));
    }

    // Neither source had data — return empty, the chart just won't render for this ticker.
    return res.status(200).json([]);
  } catch (e) {
    res.status(200).json([]);
  }
}
