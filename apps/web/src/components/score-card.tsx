import { TEST_IDS, signalRowTestId, type ScoreResult, type Signal } from "@real-role/shared";
import { BAND_LABELS, CONFIDENCE_LABELS, summarize } from "@real-role/scoring";

const BAND_STYLES = {
  high: { text: "text-high", bg: "bg-high-tint", ring: "var(--color-high)" },
  medium: { text: "text-medium", bg: "bg-medium-tint", ring: "var(--color-medium)" },
  low: { text: "text-low", bg: "bg-low-tint", ring: "var(--color-low)" },
} as const;

export function ScoreRing({ score, band }: { score: number; band: ScoreResult["band"] }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-28 w-28 shrink-0"
      role="img"
      aria-label={`Freshness score ${score} out of 100`}
    >
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-track)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={BAND_STYLES[band].ring}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="57" textAnchor="middle" className="fill-ink text-[26px] font-semibold">
        {score}
      </text>
    </svg>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const pct = signal.maxImpact > 0 ? (signal.impact / signal.maxImpact) * 100 : 0;
  return (
    <li data-testid={signalRowTestId(signal.id)} className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{signal.label}</p>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {signal.available ? (
            <>
              <span className="font-semibold text-ink">+{signal.impact}</span> of {signal.maxImpact}
            </>
          ) : (
            "Not counted"
          )}
        </p>
      </div>
      <p className="text-sm text-ink-soft">{signal.detail}</p>
      {signal.available && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm text-muted">{signal.explanation}</p>
    </li>
  );
}

export function ScoreCard({
  result,
  title,
  company,
  children,
}: {
  result: ScoreResult;
  title: string;
  company: string;
  children?: React.ReactNode;
}) {
  const style = BAND_STYLES[result.band];
  const unavailable = result.signals.filter((s) => !s.available).length;
  return (
    <section
      data-testid={TEST_IDS.web.scoreCard}
      aria-labelledby="score-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ScoreRing score={result.score} band={result.band} />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted">
            {title} · {company}
          </p>
          <h2 id="score-heading" className="mt-1 text-2xl font-semibold tracking-tight">
            <span data-testid={TEST_IDS.web.score} className="sr-only">
              {result.score}
            </span>
            <span
              data-testid={TEST_IDS.web.band}
              className={`rounded-md px-2 py-0.5 ${style.bg} ${style.text}`}
            >
              {BAND_LABELS[result.band]}
            </span>
          </h2>
          <p className="mt-2 text-ink-soft">{summarize(result)}</p>
          <p data-testid={TEST_IDS.web.confidence} className="mt-1 text-sm text-muted">
            {CONFIDENCE_LABELS[result.confidence]}
            {unavailable > 0 &&
              ` · ${unavailable} signal${unavailable === 1 ? "" : "s"} unavailable`}
            {result.usedLlm && " · includes AI review"}
          </p>
        </div>
      </div>
      <ul
        data-testid={TEST_IDS.web.signalList}
        className="mt-5 divide-y divide-line border-t border-line"
      >
        {result.signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </ul>
      {children}
    </section>
  );
}
