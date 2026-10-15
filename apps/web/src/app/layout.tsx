import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { TEST_IDS } from "@real-role/shared";
import { Logo } from "@/components/logo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Real Role: is this job still hiring?", template: "%s · Real Role" },
  description:
    "Real Role gives any job posting a Freshness Score from 0 to 100, with the signals behind it, and reminds you when to follow up.",
};

async function Account() {
  let name: string | null | undefined;
  try {
    name = (await auth())?.user?.name;
  } catch {
    name = undefined; // Auth not configured (e.g. local dev without a DB): show signed-out UI.
  }
  if (!name) {
    return (
      <Link
        href="/signin"
        data-testid={TEST_IDS.web.signInButton}
        className="whitespace-nowrap rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink-soft"
      >
        Sign in
      </Link>
    );
  }
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="flex items-center gap-3"
    >
      <span className="hidden text-sm text-muted sm:inline">{name}</span>
      <button
        type="submit"
        data-testid={TEST_IDS.web.signOutButton}
        className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium hover:bg-paper"
      >
        Sign out
      </button>
    </form>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
          >
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight"
            >
              <Logo />
              Real Role
            </Link>
            <div className="flex items-center gap-1 text-sm sm:gap-4">
              <Link
                href="/check"
                className="whitespace-nowrap rounded px-2 py-1 text-ink-soft hover:text-ink"
              >
                <span className="sm:hidden">Check</span>
                <span className="hidden sm:inline">Check a posting</span>
              </Link>
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded px-2 py-1 text-ink-soft hover:text-ink"
              >
                Dashboard
              </Link>
              <Account />
            </div>
          </nav>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
            <p>Real Role shows signals, not verdicts. Scores are estimates.</p>
            <div className="flex gap-4">
              <Link href="/how-it-works" className="hover:text-ink">
                How scoring works
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
