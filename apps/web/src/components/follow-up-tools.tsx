"use client";
import { useState } from "react";
import type { TrackedApplication } from "@real-role/shared";
import { followUpCalendar, followUpDraft } from "@/lib/follow-up";

export function FollowUpTools({ application }: { application: TrackedApplication }) {
  const [draft, setDraft] = useState(() =>
    followUpDraft(application, application.status === "interviewing" ? "interview" : "application"),
  );
  const [message, setMessage] = useState("");
  function calendar() {
    try {
      const url = URL.createObjectURL(
        new Blob([followUpCalendar(application)], { type: "text/calendar;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "real-role-follow-up.ics";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Calendar file downloaded. Import it into your calendar and choose your reminder settings.",
      );
    } catch {
      setMessage("Set a follow-up date before exporting a calendar event.");
    }
  }
  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label="Follow-up tools">
      <h3 className="font-semibold">Follow-up tools</h3>
      <button
        type="button"
        disabled={!application.followUpAt}
        onClick={calendar}
        className="rounded-lg border border-line px-3 py-2 disabled:opacity-50"
      >
        Download calendar event (.ics)
      </button>
      <p className="text-muted">
        Uses your saved follow-up time. Your calendar controls reminders; Real Role sends no
        notifications.
      </p>
      <label className="block" htmlFor="follow-up-draft">
        Editable message template
      </label>
      <select
        aria-label="Template stage"
        className="w-full rounded border border-field bg-surface p-2"
        defaultValue={application.status === "interviewing" ? "interview" : "application"}
        onChange={(e) =>
          setDraft(followUpDraft(application, e.target.value as "interview" | "application"))
        }
      >
        <option value="application">Application follow-up</option>
        <option value="interview">After an interview</option>
      </select>
      <textarea
        id="follow-up-draft"
        rows={10}
        maxLength={5000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded border border-field bg-surface p-2"
      />
      <p className="text-muted">
        Replace placeholders and review every detail before sending. This draft is not saved or
        sent.
      </p>
      <button
        type="button"
        className="rounded border border-line px-3 py-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(draft);
            setMessage("Draft copied. Review it before sending.");
          } catch {
            setMessage("Copy is unavailable. Select the draft text to copy it manually.");
          }
        }}
      >
        Copy draft
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
