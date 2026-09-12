import { MicroWorkoutApp } from "@/components/micro-workout-app";
import { ConfigurationScreen, SignInScreen } from "@/components/sign-in-screen";
import { authIsConfigured } from "@/server/auth-config";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!authIsConfigured()) {
    return process.env.NODE_ENV === "development" ? <MicroWorkoutApp /> : <ConfigurationScreen />;
  }
  const [{ auth }, { db }, { userProfiles }] = await Promise.all([
    import("@/server/auth"),
    import("@/server/db"),
    import("@/server/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <SignInScreen />;
  const [storedProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, session.user.id)).limit(1);
  const initialProfile = storedProfile ? {
    id: "profile" as const,
    name: storedProfile.displayName,
    weightUnit: storedProfile.weightUnit as "kg" | "lb",
    weeklyGoal: storedProfile.weeklyGoal,
    timezone: storedProfile.timezone,
    lastVerifiedAt: storedProfile.updatedAt.getTime(),
  } : undefined;
  const role = "role" in session.user ? session.user.role : "user";
  return <MicroWorkoutApp userId={session.user.id} userName={session.user.name} initialProfile={initialProfile} syncEnabled isAdmin={role === "admin"} />;
}
