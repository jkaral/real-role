"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApplicationResponseSchema, type TrackedApplication } from "@real-role/shared";

export function PriorApplication({ postingId }: { postingId: string }) {
  const [existing, setExisting] = useState<TrackedApplication | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    void fetch(`/api/shortlist?postingId=${encodeURIComponent(postingId)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const parsed = ApplicationResponseSchema.safeParse(await res.json());
        if (live && parsed.success) setExisting(parsed.data.application);
      })
      .catch(() => {});
    return () => {
      live = false;
      controller.abort();
    };
  }, [postingId]);
  if (!existing) return null;
  return (
    <p role="status" className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm">
      You already saved this posting. Status: {existing.status.replaceAll("_", " ")}.{" "}
      {existing.appliedAt
        ? `Applied ${new Date(existing.appliedAt).toLocaleDateString()}.`
        : `Saved ${new Date(existing.savedAt).toLocaleDateString()}.`}{" "}
      <Link href="/dashboard" className="text-brand underline">
        Review your existing application
      </Link>
      . Saving again keeps that record, status and notes.
    </p>
  );
}
