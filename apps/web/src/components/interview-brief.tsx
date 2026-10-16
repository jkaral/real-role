"use client";
import { useState } from "react";
import type { ParsedPosting } from "@real-role/shared";
import { buildInterviewBrief } from "@/lib/interview-brief";

export function InterviewBrief({ posting }: { posting: ParsedPosting }) {
  const [brief, setBrief] = useState<string | null>(null),
    [message, setMessage] = useState("");
  return (
    <section aria-label="Interview preparation" className="mt-5 border-t border-line pt-5">
      <h3 className="font-semibold">Prepare for this role</h3>
      <p className="mt-1 text-sm text-muted">
        Build a checklist and practice prompts from this posting. This runs locally, without an AI
        request, résumé upload or saved description.
      </p>
      <button
        type="button"
        className="mt-3 rounded-lg border border-line px-3 py-2 text-sm font-medium"
        onClick={() => {
          setBrief(buildInterviewBrief(posting));
          setMessage("");
        }}
      >
        Build interview brief
      </button>
      {brief && (
        <div className="mt-3 space-y-3">
          <label htmlFor="interview-brief" className="block text-sm">
            Editable preparation notes
          </label>
          <textarea
            id="interview-brief"
            rows={18}
            value={brief}
            maxLength={15000}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full rounded-lg border border-field bg-surface p-3 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded border border-line px-3 py-2 text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(brief);
                  setMessage("Brief copied.");
                } catch {
                  setMessage("Select the text to copy it manually.");
                }
              }}
            >
              Copy brief
            </button>
            <button
              type="button"
              className="rounded border border-line px-3 py-2 text-sm"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([brief], { type: "text/plain;charset=utf-8" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "real-role-interview-brief.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage("Brief downloaded. Your edits are not saved to your account.");
              }}
            >
              Download brief
            </button>
            <button
              type="button"
              className="underline text-sm"
              onClick={() => {
                setBrief(null);
                setMessage("");
              }}
            >
              Clear brief
            </button>
          </div>
          <p className="text-sm text-muted">
            Edits stay on this page until you leave. Copy or download them if you want to keep them.
          </p>
        </div>
      )}
      <p role="status" className="mt-2 text-sm">
        {message}
      </p>
    </section>
  );
}
