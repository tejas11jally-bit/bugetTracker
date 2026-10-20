// Small dependency-free SVG charts for reports (F14, F19, F24, F27).
import { formatAED } from "@/lib/money";

type Series = { label: string; values: number[]; colour: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Grouped vertical bars; values in AED fils. */
export function BarChart({ labels, series, height = 180 }: { labels: string[]; series: Series[]; height?: number }) {
  const w = 600;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = (w - pad.l - pad.r) / Math.max(labels.length, 1);
  const barW = Math.max(2, (groupW * 0.7) / series.length);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - Math.max(v, 0) / max);
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity={0.08} />
        ))}
        {labels.map((l, i) => (
          <g key={l + i}>
            {series.map((s, j) => (
              <rect key={s.label} x={pad.l + i * groupW + groupW * 0.15 + j * barW} y={y(s.values[i] ?? 0)} width={barW - 1} height={height - pad.b - y(s.values[i] ?? 0)} rx={2} fill={s.colour}>
                <title>{`${s.label} ${l}: ${formatAED(s.values[i] ?? 0)}`}</title>
              </rect>
            ))}
            <text x={pad.l + i * groupW + groupW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
              {l}
            </text>
          </g>
        ))}
      </svg>
      {series.length > 1 && <Legend series={series} />}
    </figure>
  );
}

/** Line chart; supports negative values and an optional threshold line. */
export function LineChart({ labels, series, height = 180, threshold }: { labels: string[]; series: Series[]; height?: number; threshold?: number }) {
  const w = 600;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values).concat(threshold != null ? [threshold] : []);
  const hi = Math.max(...all, 0);
  const lo = Math.min(...all, 0);
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(labels.length - 1, 1);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - (v - lo) / span);
  const step = Math.ceil(labels.length / 8);
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="currentColor" opacity={0.15} />
        {threshold != null && <line x1={pad.l} x2={w - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="#dc2626" strokeDasharray="4 4" opacity={0.7} />}
        {series.map((s) => (
          <polyline key={s.label} fill="none" stroke={s.colour} strokeWidth={2.5} strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
              {l}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 && <Legend series={series} />}
    </figure>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} />
          {s.label}
        </span>
      ))}
    </figcaption>
  );
}

/** Horizontal bars for ranked lists. */
export function HBars({ rows }: { rows: { label: string; value: number; colour?: string; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <li key={r.label + i}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="tabular shrink-0 text-muted">
              {formatAED(r.value)}
              {r.sub && <span className="ml-1 text-xs">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-2 rounded-full" style={{ width: `${(Math.max(r.value, 0) / max) * 100}%`, background: r.colour ?? "var(--accent)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
