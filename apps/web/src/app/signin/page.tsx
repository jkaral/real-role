import type { Metadata } from "next";
import { signIn, signInMethods } from "@/auth";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeCallback(value: string | string[] | undefined): string {
  const v = first(value);
  // Only same-site paths, never protocol-relative or absolute URLs.
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

const ERRORS: Record<string, string> = {
  Verification: "That sign-in link has expired or was already used. Ask for a new one below.",
  OAuthAccountNotLinked: "That account is linked to a different sign-in method. Try another one.",
  AccessDenied: "Sign-in was cancelled.",
};

const providerButton =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 font-medium hover:bg-paper";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const methods = signInMethods();
  const error = first(params.error);

  if (first(params.sent) === "1") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <Logo size={40} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-ink-soft">
          We sent you a sign-in link. It works once and expires in 24 hours. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <Logo size={40} />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to Real Role</h1>
      <p className="mt-2 text-ink-soft">
        Signing in lets you track applications and see follow-up reminders. Checking postings works
        without an account.
      </p>

      {error && (
        <p role="alert" className="mt-6 w-full rounded-lg bg-low-tint px-4 py-3 text-sm text-low">
          {ERRORS[error] ?? "Sign-in didn't work. Please try again."}
        </p>
      )}

      <div className="mt-8 w-full space-y-3 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm">
        {methods.includes("resend") && (
          <form
            action={async (form: FormData) => {
              "use server";
              await signIn("resend", {
                email: String(form.get("email") ?? ""),
                redirectTo: callbackUrl,
              });
            }}
          >
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 placeholder:text-muted focus:border-brand"
            />
            <button
              type="submit"
              className="mt-3 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-strong"
            >
              Email me a sign-in link
            </button>
          </form>
        )}

        {methods.includes("resend") && methods.length > 1 && (
          <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        )}

        {methods.includes("google") && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button type="submit" className={providerButton}>
              <GoogleIcon />
              Continue with Google
            </button>
          </form>
        )}

        {methods.includes("github") && (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl });
            }}
          >
            <button type="submit" className={providerButton}>
              <GitHubIcon />
              Continue with GitHub
            </button>
          </form>
        )}

        {methods.length === 0 && (
          <p className="text-center text-sm text-muted">
            Sign-in isn&apos;t set up on this server yet.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        We keep a display name for Google and GitHub sign-in, and your email address only if you
        sign in by email. No avatar, no contacts.
      </p>
    </div>
  );
}
