import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { receivedCoachShares } from "@/server/coach";
import { CoachWorkspace } from "./workspace";
export const metadata: Metadata = { title: "Coach workspace" };
export const dynamic = "force-dynamic";
export default async function CoachPage() {
  const userId = (await auth())?.user?.id;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Coach workspace</h1>
      <p className="mt-2 text-ink-soft">
        Read-only openings that someone explicitly shared with your account. Private notes and
        preferences are never included.
      </p>
      <CoachWorkspace
        signedIn={Boolean(userId)}
        initial={userId ? await receivedCoachShares(getDb(), userId) : []}
      />
    </div>
  );
}
