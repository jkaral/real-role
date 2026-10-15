"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">
        Please try again. If it keeps happening, come back in a few minutes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-strong"
      >
        Try again
      </button>
    </div>
  );
}
