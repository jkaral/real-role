import type { Metadata } from "next";
import { signIn } from "@/auth";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

function safeCallback(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  // Only same-site paths, never protocol-relative or absolute URLs.
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const callbackUrl = safeCallback((await searchParams).callbackUrl);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <Logo size={40} />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to Real Role</h1>
      <p className="mt-2 text-ink-soft">
        Signing in lets you track applications and get follow-up reminders. Checking postings works
        without an account.
      </p>
      <form
        className="mt-8 w-full"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: callbackUrl });
        }}
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-medium text-white hover:bg-ink-soft"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </button>
      </form>
      <p className="mt-4 text-xs text-muted">
        We keep your GitHub display name only. No email, no avatar.
      </p>
    </div>
  );
}
