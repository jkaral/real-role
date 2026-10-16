import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TEST_IDS } from "@real-role/shared";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { listApplications } from "@/server/applications";
import { ApplicationsTable } from "./applications-table";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/dashboard");
  const applications = await listApplications(getDb(), userId);

  return (
    <div data-testid={TEST_IDS.web.dashboard} className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your applications</h1>
          <p className="mt-2 text-ink-soft">
            Track where you applied and when to follow up. Press / to search.
          </p>
        </div>
        <Link
          href="/check"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-strong"
        >
          Check a posting
        </Link>
      </div>
      <nav aria-label="Application tools" className="mt-6 flex flex-wrap gap-4">
        <Link href="/coach" className="font-medium text-brand underline">
          Coach workspace
        </Link>
        <Link href="/insights" className="font-medium text-brand underline">
          View search insights
        </Link>
        <Link href="/shortlist" className="font-medium text-brand underline">
          Open your personal shortlist
        </Link>
      </nav>
      <ApplicationsTable initial={applications} />
    </div>
  );
}
