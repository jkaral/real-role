import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getDb, schema } from "@/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
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
  ],
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  trustHost: true,
}));
