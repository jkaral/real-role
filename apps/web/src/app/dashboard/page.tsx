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
            Track where you applied. We&apos;ll flag the ones due for a follow-up.
          </p>
        </div>
        <Link
          href="/check"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong"
        >
          Check a posting
        </Link>
      </div>
      {applications.length === 0 ? (
        <div
          data-testid={TEST_IDS.web.dashboardEmpty}
          className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center"
        >
          <p className="font-medium">Nothing tracked yet</p>
          <p className="mt-1 text-sm text-muted">
            Use &ldquo;Save &amp; track&rdquo; on the check page or in the Chrome extension to add a
            posting here.
          </p>
        </div>
      ) : (
        <ApplicationsTable initial={applications} />
      )}
    </div>
  );
}
