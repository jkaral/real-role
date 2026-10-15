import type { Metadata } from "next";
import { CheckForm } from "./check-form";

export const metadata: Metadata = { title: "Check a posting" };

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Check a posting</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Paste a link or the posting text. You&apos;ll get a Freshness Score from 0 to 100 and every
        signal behind it.
      </p>
      <div className="mt-8">
        <CheckForm
          initialMode={params.mode === "text" ? "text" : "url"}
          resume={params.resume === "1"}
        />
      </div>
    </div>
  );
}
