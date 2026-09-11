import { and, eq, inArray } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import { accounts, authSessions, invitations, userProfiles, users, verifications } from "./db/schema";

const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

// Normalize BETTER_AUTH_URL: if the value is a bare hostname, prepend https://
const rawBetterAuthURL = process.env.BETTER_AUTH_URL?.trim();
const betterAuthURL = rawBetterAuthURL && !/^https?:\/\//i.test(rawBetterAuthURL) ? `https://${rawBetterAuthURL}` : rawBetterAuthURL;

export const auth = betterAuth({
  appName: "MicroWorkout",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: betterAuthURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { users, sessions: authSessions, accounts, verifications },
    usePlural: true,
    transaction: true,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.trim().toLowerCase();
          if (email !== ownerEmail) {
            const invitation = await db.query.invitations.findFirst({
              where: and(eq(invitations.email, email), inArray(invitations.status, ["pending", "active"])),
            });
            if (!invitation) return false;
          }
          return { data: { ...user, email, role: email === ownerEmail ? "admin" : "user" } };
        },
        after: async (user) => {
          const email = user.email.trim().toLowerCase();
          await db.transaction(async (tx) => {
            await tx.insert(userProfiles).values({ userId: user.id, displayName: user.name }).onConflictDoNothing();
            if (email === ownerEmail) {
              await tx.insert(invitations).values({ email, status: "active", acceptedByUserId: user.id }).onConflictDoUpdate({ target: invitations.email, set: { status: "active", acceptedByUserId: user.id, updatedAt: new Date() } });
            } else {
              await tx.update(invitations).set({ status: "active", acceptedByUserId: user.id, updatedAt: new Date() }).where(eq(invitations.email, email));
            }
          });
        },
      },
      delete: { before: async (user) => user.email.trim().toLowerCase() !== ownerEmail },
    },
    session: {
      create: {
        before: async (session) => {
          const [user] = await db.select({ email: users.email, banned: users.banned }).from(users).where(eq(users.id, session.userId)).limit(1);
          if (!user || user.banned) return false;
          if (user.email.toLowerCase() === ownerEmail) return;
          const invitation = await db.query.invitations.findFirst({ where: and(eq(invitations.email, user.email.toLowerCase()), eq(invitations.status, "active")) });
          return Boolean(invitation);
        },
      },
    },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});
