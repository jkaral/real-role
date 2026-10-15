"use client";

import type { ScoreResult } from "@real-role/shared";
import { useState } from "react";
import { ScoreCard } from "./score-card";

export interface Example {
  key: string;
  label: string;
  title: string;
  company: string;
  result: ScoreResult;
}

/** Real engine results for fictional postings; the visitor flips between them. */
export function ExampleSwitcher({ examples }: { examples: Example[] }) {
  const [active, setActive] = useState(0);
  const example = examples[active];
  if (!example) return null;
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Example postings (fictional)"
        className="mb-3 flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="text-muted">Try an example:</span>
        {examples.map((e, i) => (
          <button
            key={e.key}
            type="button"
            role="radio"
            aria-checked={i === active}
            onClick={() => setActive(i)}
            className={`rounded-full border px-3 py-1 font-medium transition-colors ${
              i === active
                ? "border-brand bg-brand-tint text-brand"
                : "border-line bg-surface text-ink-soft hover:border-brand hover:text-ink"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div key={example.key} className="animate-rise">
        <ScoreCard result={example.result} title={example.title} company={example.company} />
      </div>
    </div>
  );
}
