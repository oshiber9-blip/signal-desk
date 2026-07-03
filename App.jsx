import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Newspaper, CalendarClock, Info, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// WATCHLIST — the tickers this desk tracks and their assigned horizon.
// Add/remove tickers here; everything else is fetched live from /api/*.
// ---------------------------------------------------------------------------
const WATCHLIST = [
  { ticker: "NVDA", name: "Nvidia Corp", horizon: "long" },
  { ticker: "MSFT", name: "Microsoft Corp", horizon: "long" },
  { ticker: "SMCI", name: "Super Micro Computer", horizon: "short" },
  { ticker: "PLTR", name: "Palantir Technologies", horizon: "short" },
  { ticker: "JNJ", name: "Johnson & Johnson", horizon: "long" },
  { ticker: "COIN", name: "Coinbase Global", horizon: "short" },
  { ticker: "AVGO", name: "Broadcom Inc", horizon: "long" },
  { ticker: "RIVN", name: "Rivian Automotive", horizon: "short" },
];

const HOLD_WINDOW = { short: "3–10 trading days", long: "6–24 months" };
const TARGET_PCT = { short: 0.08, long: 0.20 };
const RISK_PCT = { short: 0.06, long: 0.12 };

const sentimentColor = { bullish: "var(--up)", bearish: "var(--down)", neutral: "var(--muted)" };
const sentimentIcon = { bullish: ArrowUpRight, bearish: ArrowDownRight, neutral: Minus };

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Data fetching — combines quote + news per ticker into the screener shape.
// ---------------------------------------------------------------------------
async function fetchStock(entry) {
  const [quoteRes, newsRes] = await Promise.all([
    fetch(`/api/quote?symbol=${entry.ticker}`).then((r) => r.json()),
    fetch(`/api/news?symbol=${entry.ticker}`).then((r) => r.json()).catch(() => []),
  ]);

  const price = quoteRes.c ?? 0;
  const change = quoteRes.dp ?? 0;
  const high = quoteRes.h ?? price;
  const low = quoteRes.l ?? price;

  const newsItems = Array.isArray(newsRes) ? newsRes : [];
  const bullish = newsItems.filter((n) => n.sentiment === "bullish").length;
  const bearish = newsItems.filter((n) => n.sentiment === "bearish").length;
  const sentimentScore = newsItems.length
    ? clamp(Math.round(50 + ((bullish - bearish) / newsItems.length) * 50), 0, 100)
    : 50;

  const momentum = clamp(Math.round(50 + change * 6), 0, 100);
  const rangePos = high > low ? clamp(Math.round(((price - low) / (high - low)) * 100), 0, 100) : 50;

  const entryPrice = price;
  const target = entryPrice * (1 + TARGET_PCT[entry.horizon]);
  const stop = entryPrice * (1 - RISK_PCT[entry.horizon]);
  const rr = ((target - entryPrice) / (entryPrice - stop)).toFixed(1);

  return {
    ...entry,
    price,
    change,
    momentum,
    rangePos,
    sentiment: sentimentScore,
    entry: entryPrice,
    target,
    stop,
    rr,
    news: newsItems,
    catalyst: newsItems[0]?.headline || "No recent headlines in the last 7 days.",
  };
}

async function fetchEarnings() {
  const data = await fetch("/api/earnings").then((r) => r.json()).catch(() => []);
  const tickers = new Set(WATCHLIST.map((w) => w.ticker));
  return (Array.isArray(data) ? data : [])
    .filter((e) => tickers.has(e.symbol))
    .map((e) => ({
      date: e.date,
      label: `${e.symbol} Earnings`,
      detail: e.epsEstimate != null ? `Analyst EPS estimate: $${e.epsEstimate}` : "Earnings date confirmed.",
      tickers: [e.symbol],
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------
function ScoreBar({ label, value }) {
  return (
    <div className="scorebar">
      <div className="scorebar-label">
        <span>{label}</span>
        <span className="scorebar-value">{value}</span>
      </div>
      <div className="scorebar-track">
        <div className="scorebar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Screener({ stocks, loading, error }) {
  const [horizon, setHorizon] = useState("all");
  const filtered = useMemo(
    () => stocks.filter((s) => horizon === "all" || s.horizon === horizon)
      .sort((a, b) => (b.momentum + b.sentiment) - (a.momentum + a.sentiment)),
    [stocks, horizon]
  );

  if (loading) return <div className="state-msg"><Loader2 className="spin" size={18} /> Pulling live quotes and news…</div>;
  if (error) return <div className="state-msg error">Couldn't load live data: {error}</div>;

  return (
    <div>
      <div className="filter-row">
        {["all", "long", "short"].map((h) => (
          <button key={h} className={`pill ${horizon === h ? "pill-active" : ""}`} onClick={() => setHorizon(h)}>
            {h === "all" ? "All horizons" : h === "long" ? "Long-term" : "Short-term"}
          </button>
        ))}
      </div>

      <div className="stock-grid">
        {filtered.map((s) => (
          <div className="stock-card" key={s.ticker}>
            <div className="stock-card-top">
              <div>
                <div className="ticker">{s.ticker}</div>
                <div className="company">{s.name}</div>
              </div>
              <div className="price-block">
                <div className="price">${s.price.toFixed(2)}</div>
                <div className={`change ${s.change >= 0 ? "up" : "down"}`}>
                  {s.change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {Math.abs(s.change).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="horizon-row">
              <span className={`horizon-tag ${s.horizon}`}>{s.horizon === "long" ? "Long-term watch" : "Short-term swing"}</span>
              <span className="hold-window">Hold: {HOLD_WINDOW[s.horizon]}</span>
            </div>

            <div className="levels-grid">
              <div className="level"><span className="level-label">Buy-in</span><span className="level-value">${s.entry.toFixed(2)}</span></div>
              <div className="level"><span className="level-label">Target</span><span className="level-value target">${s.target.toFixed(2)}</span></div>
              <div className="level"><span className="level-label">Risk level</span><span className="level-value stop">${s.stop.toFixed(2)}</span></div>
              <div className="level"><span className="level-label">R / R</span><span className="level-value">{s.rr}:1</span></div>
            </div>
            <p className="fractional-note">Fractional shares available from $1 — no need to buy in at the full price above.</p>

            <div className="scores">
              <ScoreBar label="Momentum (today)" value={s.momentum} />
              <ScoreBar label="Day range strength" value={s.rangePos} />
              <ScoreBar label="News sentiment (7d)" value={s.sentiment} />
            </div>

            <p className="catalyst">{s.catalyst}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsPulse({ stocks, loading, error }) {
  const allNews = useMemo(
    () => stocks.flatMap((s) => s.news || []).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20),
    [stocks]
  );

  if (loading) return <div className="state-msg"><Loader2 className="spin" size={18} /> Pulling live headlines…</div>;
  if (error) return <div className="state-msg error">Couldn't load live news: {error}</div>;
  if (!allNews.length) return <div className="state-msg">No fresh headlines on your watchlist in the last 7 days.</div>;

  return (
    <div className="news-list">
      {allNews.map((n, i) => {
        const Icon = sentimentIcon[n.sentiment];
        return (
          <a className="news-item" key={i} href={n.url} target="_blank" rel="noreferrer">
            <div className="news-icon" style={{ color: sentimentColor[n.sentiment] }}><Icon size={16} /></div>
            <div className="news-body">
              <div className="news-meta">
                <span className="news-source">{n.source}</span>
                <span className="news-dot">·</span>
                <span>{timeAgo(n.time)}</span>
                <span className="news-dot">·</span>
                <span className="news-sentiment" style={{ color: sentimentColor[n.sentiment] }}>{n.sentiment}</span>
              </div>
              <div className="news-headline">{n.headline}</div>
              <div className="news-tickers"><span className="mini-tag">{n.ticker}</span></div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Planner({ events, loading, error }) {
  if (loading) return <div className="state-msg"><Loader2 className="spin" size={18} /> Pulling the earnings calendar…</div>;
  if (error) return <div className="state-msg error">Couldn't load the calendar: {error}</div>;
  if (!events.length) return <div className="state-msg">No confirmed earnings dates for your watchlist in the next 30 days yet.</div>;

  return (
    <div className="planner">
      <div className="planner-line" />
      {events.map((p, i) => (
        <div className="planner-item" key={i}>
          <div className="planner-date">{new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          <div className="planner-dot" />
          <div className="planner-card">
            <div className="planner-label">{p.label}</div>
            <p className="planner-detail">{p.detail}</p>
            <div className="news-tickers">{p.tickers.map((t) => <span className="mini-tag" key={t}>{t}</span>)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function SignalDesk() {
  const [tab, setTab] = useState("screener");
  const [stocks, setStocks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stockResults, earningsResults] = await Promise.all([
          Promise.all(WATCHLIST.map(fetchStock)),
          fetchEarnings(),
        ]);
        if (!cancelled) {
          setStocks(stockResults);
          setEvents(earningsResults);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000); // refresh every 60s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const marqueeItems = [...stocks, ...stocks];

  return (
    <div className="sd-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .sd-root {
          --bg: #F5FAF3;
          --ink: #14261C;
          --panel: #FFFFFF;
          --panel-alt: #EDF6E9;
          --line: #DCE8D6;
          --paper: #1B2A20;
          --muted: #6B7A70;
          --gold: #00B67A;
          --amber: #F0A93B;
          --up: #16A34A;
          --down: #E35348;
          background: var(--bg);
          color: var(--paper);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          padding-bottom: 40px;
        }

        .marquee-strip { background: var(--ink); border-bottom: 1px solid var(--line); overflow: hidden; white-space: nowrap; padding: 8px 0; }
        .marquee-track { display: inline-flex; animation: scroll-left 38s linear infinite; }
        @keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-entry { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; margin-right: 28px; color: #A9BDAE; }
        .marquee-entry b { color: #F5FAF3; margin-right: 6px; }
        .marquee-entry .up { color: #4ADE80; }
        .marquee-entry .down { color: #FF8A80; }

        .header { max-width: 1040px; margin: 0 auto; padding: 40px 24px 20px; }
        .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .gl-badge { background: var(--gold); color: #fff; font-family: 'Inter', sans-serif; text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 10.5px; padding: 2px 8px; border-radius: 999px; }
        .live-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--up); font-family: 'Inter', sans-serif; text-transform: none; letter-spacing: 0; font-weight: 600; }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--up); animation: pulse 1.6s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .h1 { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 42px; line-height: 1.05; margin: 0 0 8px; color: var(--ink); }
        .sub { color: var(--muted); font-size: 14.5px; max-width: 580px; line-height: 1.55; }

        .disclaimer { max-width: 1040px; margin: 0 auto 24px; padding: 0 24px; }
        .disclaimer-box { display: flex; gap: 10px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 8px; padding: 12px 14px; font-size: 12.5px; color: var(--muted); line-height: 1.5; box-shadow: 0 1px 2px rgba(20,38,28,0.04); }

        .tabs { max-width: 1040px; margin: 0 auto; padding: 0 24px; display: flex; gap: 4px; border-bottom: 1px solid var(--line); }
        .tab { background: none; border: none; color: var(--muted); font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 600; padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 6px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .tab:hover { color: var(--ink); }
        .tab-active { color: var(--ink); border-bottom-color: var(--gold); }

        .content { max-width: 1040px; margin: 0 auto; padding: 28px 24px 0; }
        .gl-note { max-width: 1040px; margin: 0 auto 14px; padding: 0 24px; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }

        .state-msg { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13.5px; padding: 40px 0; justify-content: center; }
        .state-msg.error { color: var(--down); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .filter-row { display: flex; gap: 8px; margin-bottom: 20px; }
        .pill { background: var(--panel); border: 1px solid var(--line); color: var(--muted); font-family: 'Inter', sans-serif; font-size: 12.5px; padding: 7px 14px; border-radius: 999px; cursor: pointer; }
        .pill-active { color: #fff; background: var(--gold); border-color: var(--gold); font-weight: 600; }

        .stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .stock-card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(20,38,28,0.05); }
        .stock-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .ticker { font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600; letter-spacing: 0.02em; color: var(--ink); }
        .company { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .price-block { text-align: right; }
        .price { font-family: 'IBM Plex Mono', monospace; font-size: 15px; }
        .change { display: flex; align-items: center; gap: 3px; justify-content: flex-end; font-size: 12px; margin-top: 2px; font-family: 'IBM Plex Mono', monospace; }
        .change.up { color: var(--up); }
        .change.down { color: var(--down); }

        .horizon-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .horizon-tag { display: inline-block; font-size: 11px; font-family: 'Inter', sans-serif; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
        .horizon-tag.long { background: rgba(22,163,74,0.12); color: var(--up); }
        .horizon-tag.short { background: rgba(240,169,59,0.16); color: var(--amber); }
        .hold-window { font-size: 11px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

        .levels-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
        .level { background: var(--panel-alt); padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .level-label { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; font-family: 'IBM Plex Mono', monospace; }
        .level-value { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink); }
        .level-value.target { color: var(--up); }
        .level-value.stop { color: var(--down); }
        .fractional-note { font-size: 10.5px; color: var(--muted); margin: 0 0 14px; font-style: italic; }

        .scores { display: flex; flex-direction: column; gap: 9px; margin-bottom: 14px; }
        .scorebar-label { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 3px; }
        .scorebar-value { font-family: 'IBM Plex Mono', monospace; color: var(--ink); }
        .scorebar-track { background: var(--line); height: 5px; border-radius: 3px; overflow: hidden; }
        .scorebar-fill { background: var(--gold); height: 100%; border-radius: 3px; }

        .catalyst { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0; border-top: 1px solid var(--line); padding-top: 12px; }

        .news-list { display: flex; flex-direction: column; gap: 2px; }
        .news-item { display: flex; gap: 12px; padding: 16px 4px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .news-item:hover { background: var(--panel-alt); }
        .news-icon { margin-top: 3px; flex-shrink: 0; }
        .news-meta { font-size: 11.5px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; margin-bottom: 5px; display: flex; gap: 6px; align-items: center; text-transform: uppercase; letter-spacing: 0.03em; }
        .news-dot { opacity: 0.5; }
        .news-headline { font-size: 15px; line-height: 1.4; margin-bottom: 8px; color: var(--ink); }
        .news-tickers { display: flex; gap: 6px; flex-wrap: wrap; }
        .mini-tag { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; background: var(--panel-alt); border: 1px solid var(--line); padding: 2px 8px; border-radius: 999px; color: var(--muted); }

        .planner { position: relative; padding-left: 4px; }
        .planner-line { position: absolute; left: 78px; top: 6px; bottom: 6px; width: 1px; background: var(--line); }
        .planner-item { display: flex; gap: 20px; position: relative; padding-bottom: 26px; }
        .planner-date { width: 58px; flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--gold); padding-top: 3px; text-align: right; }
        .planner-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--gold); margin-top: 5px; flex-shrink: 0; box-shadow: 0 0 0 3px var(--bg); z-index: 1; }
        .planner-card { flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(20,38,28,0.05); }
        .planner-label { font-family: 'Baloo 2', sans-serif; font-weight: 600; font-size: 16px; margin-bottom: 5px; color: var(--ink); }
        .planner-detail { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0 0 10px; }
      `}</style>

      <div className="marquee-strip">
        <div className="marquee-track">
          {marqueeItems.map((s, i) => (
            <span className="marquee-entry" key={i}>
              <b>{s.ticker}</b>${s.price?.toFixed(2)}{" "}
              <span className={s.change >= 0 ? "up" : "down"}>{s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change ?? 0).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>

      <div className="header">
        <div className="eyebrow">
          Market Desk · Live Session
          <span className="gl-badge">Fractional-share friendly</span>
          <span className="live-badge"><span className="live-dot" />LIVE</span>
        </div>
        <h1 className="h1">Bullpen</h1>
        <p className="sub">
          Live prices and news from Finnhub, refreshed every 60 seconds. Ranked by momentum, day-range
          strength, and news sentiment — sorted into defined short-swing (3–10 day) and long-term
          (6–24 month) windows, built around fractional-share, no-margin investing.
        </p>
      </div>

      <div className="gl-note">
        <Info size={13} />
        Works with fractional shares from $1 · no trading fees · every trade still needs parent approval
      </div>

      <div className="disclaimer">
        <div className="disclaimer-box">
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Prices and headlines are live. Targets, risk levels, and scores are computed from a disclosed,
            rules-based formula on top of that live data — they are projections, not predictions or
            guarantees. This is a decision-support tool, not financial advice.
          </span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "screener" ? "tab-active" : ""}`} onClick={() => setTab("screener")}><TrendingUp size={14} /> Screener</button>
        <button className={`tab ${tab === "news" ? "tab-active" : ""}`} onClick={() => setTab("news")}><Newspaper size={14} /> News Pulse</button>
        <button className={`tab ${tab === "planner" ? "tab-active" : ""}`} onClick={() => setTab("planner")}><CalendarClock size={14} /> Planner</button>
      </div>

      <div className="content">
        {tab === "screener" && <Screener stocks={stocks} loading={loading} error={error} />}
        {tab === "news" && <NewsPulse stocks={stocks} loading={loading} error={error} />}
        {tab === "planner" && <Planner events={events} loading={loading} error={error} />}
      </div>
    </div>
  );
}
