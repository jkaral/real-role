import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-ink-soft">That page doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-6 inline-block font-medium text-brand hover:underline">
        Back to Real Role
      </Link>
    </div>
  );
}
