import React, { useEffect, useMemo, useRef, useState } from "react";

// A line chart drawn by hand in SVG. No chart library, so there is nothing to install and every part of it is in this file.
//
// How to use it:
//   points        the data, oldest first: [{ t: <time as a number>, tempC: 31.2, avgC: 29.8, ... }, ...]
//   lines         which keys to draw: [{ key: "tempC", label: "Hottest city", color: "#f6ad55", dash: "5 4" }, ...]
//   forecastFrom  a time; everything after it gets a shaded "forecast" background
//   fmtX / fmtTip how to print a time on the axis / in the hover box (dates by default)
//
// It measures how wide it is and draws at exactly that width (see the ResizeObserver below). We used to draw it at a
// fixed size and let the browser scale it, but then the text became huge on wide screens and tiny on phones.
const M = { l: 44, r: 14, t: 16, b: 28 }; // empty space around the plot: left (for the y labels), right, top, bottom (x labels)

// Picks a tidy gap between the horizontal grid lines (1, 2, 5, 10, 20, 50...) so the axis reads 30, 35, 40 and not 31.7, 35.4...
function niceStep(range, ticks) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

export default function LineChart({ points, lines, height = 260, unit = "°C", forecastFrom = null, fmtX, fmtTip, label = "Chart" }) {
  const [hover, setHover] = useState(null); // index of the point the mouse/finger is nearest to, or null
  const [W, setW] = useState(760);               // the chart's current width in pixels (updated by the ResizeObserver)
  const wrapRef = useRef(null);
  const H = height;

  // keep W equal to the width of the box the chart sits in, also when the window is resized
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setW(Math.max(300, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // All the maths, redone only when the data or the width changes: the scales, the axis labels and the line paths.
  const model = useMemo(() => {
    const values = [];
    points.forEach((p) => lines.forEach((l) => { if (typeof p[l.key] === "number") values.push(p[l.key]); }));
    if (!values.length) return null;
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    // a nearly flat line would fill the whole height and look dramatic; make sure the y axis spans at least 4 degrees
    if (hi - lo < 4) { const mid = (hi + lo) / 2; lo = mid - 2; hi = mid + 2; }
    const step = niceStep(hi - lo, 4);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hi / step) * step;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    // sx / sy turn a time or a temperature into a pixel position inside the plot
    const sx = (t) => M.l + ((t - t0) / (t1 - t0 || 1)) * (W - M.l - M.r);
    const sy = (v) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
    const yTicks = [];
    for (let v = y0; v <= y1 + 1e-9; v += step) yTicks.push(Number(v.toFixed(2)));
    const count = Math.max(2, Math.min(points.length, Math.floor(W / 120)));
    const xTicks = Array.from({ length: count }, (_, i) => points[Math.round((i * (points.length - 1)) / Math.max(1, count - 1))]);
    // Build each line as an SVG path ("M x,y L x,y ..."). A missing value lifts the pen, so the line has a gap there
    // instead of dropping to zero.
    const paths = lines.map((l) => {
      let d = "";
      let pen = false;
      points.forEach((p) => {
        const v = p[l.key];
        if (typeof v !== "number") { pen = false; return; }
        d += `${pen ? "L" : "M"}${sx(p.t).toFixed(1)},${sy(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    });
    return { sx, sy, yTicks, xTicks, paths };
  }, [points, lines, H, W]);

  const defaultX = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

  if (!model) return <div className="lv-chart" ref={wrapRef}><div className="data-state">No data stored for this period yet.</div></div>;
  const { sx, sy, yTicks, xTicks, paths } = model;
  const hp = hover === null ? null : points[hover];
  const fx = forecastFrom !== null ? sx(forecastFrom) : null;
  const narrow = fx !== null && W - M.r - fx < 70;

  // the tooltip follows the pointer: find the data point whose x position is closest to where the pointer is
  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(sx(p.t) - x) < Math.abs(sx(points[best].t) - x)) best = i; });
    setHover(best);
  };

  return (
    <div className="lv-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {fx !== null && fx < W - M.r && (
          <g>
            <rect x={fx} y={M.t} width={W - M.r - fx} height={H - M.t - M.b} className="lv-chart-forecast" />
            <text x={narrow ? fx - 6 : fx + 6} y={M.t + 12} textAnchor={narrow ? "end" : "start"} className="lv-chart-note">forecast</text>
          </g>
        )}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="lv-chart-grid" />
            <text x={M.l - 8} y={sy(v) + 4} textAnchor="end" className="lv-chart-axis">{v}{unit === "°C" ? "°" : unit}</text>
          </g>
        ))}
        {xTicks.map((p, i) => (
          <text key={p.t} x={sx(p.t)} y={H - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="lv-chart-axis">{(fmtX || defaultX)(p.t)}</text>
        ))}
        {lines.map((l, i) => (
          <path key={l.key} d={paths[i]} fill="none" stroke={l.color} strokeWidth={l.width || 2} strokeDasharray={l.dash || undefined} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.length < 3 && lines.map((l) => points.map((p) => typeof p[l.key] === "number" && (
          <circle key={`${l.key}-${p.t}`} cx={sx(p.t)} cy={sy(p[l.key])} r="4" fill={l.color} />
        )))}
        {hp && (
          <g>
            <line x1={sx(hp.t)} x2={sx(hp.t)} y1={M.t} y2={H - M.b} className="lv-chart-cursor" />
            {lines.map((l) => typeof hp[l.key] === "number" && <circle key={l.key} cx={sx(hp.t)} cy={sy(hp[l.key])} r="4.5" fill={l.color} stroke="#0b1422" strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hp && (
        <div className="lv-chart-tip" style={{ left: `${Math.min(78, Math.max(2, (sx(hp.t) / W) * 100 - 8))}%` }}>
          <strong>{(fmtTip || fmtX || defaultX)(hp.t)}</strong>
          {lines.map((l) => (
            <span key={l.key}><i style={{ background: l.color }} />{l.label}: {typeof hp[l.key] === "number" ? `${hp[l.key].toFixed(1)}${unit}` : "—"}</span>
          ))}
        </div>
      )}
      <div className="lv-chart-legend">
        {lines.map((l) => (
          <span key={l.key}><i style={l.dash ? { background: `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)` } : { background: l.color }} />{l.label}</span>
        ))}
      </div>
    </div>
  );
}
