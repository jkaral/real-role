import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getDb, schema } from "@/db/client";

export type SignInMethod = "resend" | "google" | "github";

/** Sign-in methods whose secrets are configured, in display order (email first). */
export function signInMethods(env: NodeJS.ProcessEnv = process.env): SignInMethod[] {
  const methods: SignInMethod[] = [];
  if (env.AUTH_RESEND_KEY && env.AUTH_EMAIL_FROM) methods.push("resend");
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) methods.push("google");
  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) methods.push("github");
  return methods;
}

function providers(): Provider[] {
  const methods = signInMethods();
  const list: Provider[] = [];
  if (methods.includes("resend")) {
    // Email sign-in needs the address to send the link to; it's the only case we store one.
    list.push(Resend({ from: process.env.AUTH_EMAIL_FROM }));
  }
  if (methods.includes("google")) {
    list.push(
      Google({
        // A2 minimal data: keep only a display name.
        profile(profile) {
          return { id: profile.sub, name: profile.name ?? null, email: null, image: null };
        },
      }),
    );
  }
  if (methods.includes("github")) {
    list.push(
      GitHub({
        // A2 minimal data: keep only a display name. No email address or avatar.
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.name ?? profile.login,
            email: null,
            image: null,
          };
        },
      }),
    );
  }
  return list;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: providers(),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1", error: "/signin" },
  trustHost: true,
}));
