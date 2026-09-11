import { asc, eq, isNull } from "drizzle-orm";

async function requireAdmin(request: Request) {
  const [{ auth }, { db }] = await Promise.all([import("@/server/auth"), import("@/server/db")]);
  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user && "role" in session.user ? session.user.role : "user";
  if (!session || role !== "admin") return null;
  return { db };
}

export async function GET(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { exercises } = await import("@/server/db/schema");
  const records = await context.db.select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup, equipment: exercises.equipment, builtin: exercises.builtin, retiredAt: exercises.retiredAt }).from(exercises).where(isNull(exercises.deletedAt)).orderBy(asc(exercises.name));
  return Response.json(records.filter((exercise) => !exercise.builtin && !exercise.retiredAt));
}

export async function DELETE(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = await request.json().catch(() => undefined) as { id?: unknown } | undefined;
  if (typeof parsed?.id !== "string") return Response.json({ error: "Exercise id required" }, { status: 400 });
  const { exercises } = await import("@/server/db/schema");
  const [exercise] = await context.db.select().from(exercises).where(eq(exercises.id, parsed.id)).limit(1);
  if (!exercise || exercise.builtin) return Response.json({ error: "Shared custom exercise not found" }, { status: 404 });
  await context.db.update(exercises).set({ retiredAt: new Date(), updatedAt: new Date() }).where(eq(exercises.id, exercise.id));
  return Response.json({ id: exercise.id, retiredAt: Date.now() });
}
