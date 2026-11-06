"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/check", short: "Check", long: "Check a posting" },
  { href: "/dashboard", short: "Dashboard", long: "Dashboard" },
  { href: "/extension", short: "Extension", long: "Get the extension" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-2 py-1 ${
              active ? "bg-brand-tint font-medium text-brand" : "text-ink-soft hover:text-ink"
            } ${l.href === "/extension" ? "hidden md:inline" : ""}`}
          >
            <span className="sm:hidden">{l.short}</span>
            <span className="hidden sm:inline">{l.long}</span>
          </Link>
        );
      })}
    </>
  );
}

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = {
  system: "Theme: match system",
  light: "Theme: light",
  dark: "Theme: dark",
};

function readTheme(): Theme {
  try {
    const v = localStorage.getItem("rr-theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Applies a stored theme before first paint, so there's no flash. Inlined in <head>. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("rr-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The header shows it from `sm` up; the footer shows a second one on phones. */
export function ThemeToggle({ className = "hidden sm:inline-flex" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("rr-theme");
      else localStorage.setItem("rr-theme", next);
    } catch {
      /* storage blocked: still apply for this page */
    }
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[theme]}. Change theme`}
      title={LABEL[theme]}
      className={`rounded-md p-2 text-ink-soft hover:bg-paper hover:text-ink ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {theme === "dark" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
        ) : theme === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
