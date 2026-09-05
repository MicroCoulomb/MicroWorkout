import { MicroWorkoutApp } from "@/components/micro-workout-app";
import { ConfigurationScreen, SignInScreen } from "@/components/sign-in-screen";
import { authIsConfigured } from "@/server/auth-config";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!authIsConfigured()) {
    return process.env.NODE_ENV === "development" ? <MicroWorkoutApp /> : <ConfigurationScreen />;
  }
  const { auth } = await import("@/server/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <SignInScreen />;
  const role = "role" in session.user ? session.user.role : "user";
  const isOwner = session.user.email.toLowerCase() === process.env.OWNER_EMAIL?.trim().toLowerCase();
  return <MicroWorkoutApp userId={session.user.id} userName={session.user.name} syncEnabled isAdmin={role === "admin"} canDeleteAccount={!isOwner} />;
}
