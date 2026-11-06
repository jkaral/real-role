import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { readShortlist } from "@/server/shortlist";
import { Shortlist } from "./shortlist";

export const metadata: Metadata = { title: "Personal shortlist" };
export const dynamic = "force-dynamic";
export default async function ShortlistPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/shortlist");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your personal shortlist</h1>
      <p className="mt-2 text-ink-soft">
        Rank your saved openings by your preferences. Fit and freshness are separate; missing facts
        stay unknown.
      </p>
      <Shortlist initial={await readShortlist(getDb(), userId)} />
    </div>
  );
}
