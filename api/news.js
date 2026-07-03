// api/news.js
// Live company headlines for one ticker, last 7 days, tagged bullish/bearish/neutral
// using a simple disclosed keyword rule (not a black-box model).
// Vercel env var required: FINNHUB_KEY

const POSITIVE_WORDS = ["surge", "beat", "growth", "upgrade", "record", "rally", "gain", "expand", "strong", "soar", "jump", "outperform"];
const NEGATIVE_WORDS = ["fall", "miss", "downgrade", "probe", "lawsuit", "cut", "decline", "drop", "weak", "plunge", "scrutiny", "recall", "investigation"];

function tagSentiment(headline = "") {
  const h = headline.toLowerCase();
  const pos = POSITIVE_WORDS.some((w) => h.includes(w));
  const neg = NEGATIVE_WORDS.some((w) => h.includes(w));
  if (pos && !neg) return "bullish";
  if (neg && !pos) return "bearish";
  return "neutral";
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`
    );
    if (!r.ok) return res.status(r.status).json({ error: "Finnhub error" });
    const data = await r.json();

    const items = (Array.isArray(data) ? data : [])
      .slice(0, 6)
      .map((a) => ({
        ticker: symbol,
        source: a.source,
        time: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
        headline: a.headline,
        url: a.url,
        sentiment: tagSentiment(a.headline),
      }));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
