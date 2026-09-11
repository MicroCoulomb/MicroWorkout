import { asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { MUSCLE_GROUPS } from "@/domain/types";

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
  return Response.json(records);
}

const editExerciseSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(120), muscleGroup: z.enum(MUSCLE_GROUPS), equipment: z.enum(["Bodyweight", "Dumbbells"]) });

export async function PATCH(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = editExerciseSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid exercise" }, { status: 400 });
  const { exercises } = await import("@/server/db/schema");
  const normalizedName = parsed.data.name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const [existing] = await context.db.select({ id: exercises.id }).from(exercises).where(eq(exercises.normalizedName, normalizedName)).limit(1);
  if (existing && existing.id !== parsed.data.id) return Response.json({ error: "An exercise with that name already exists" }, { status: 409 });
  const [updated] = await context.db.update(exercises).set({ name: parsed.data.name.trim(), normalizedName, muscleGroup: parsed.data.muscleGroup, equipment: parsed.data.equipment, updatedAt: new Date(), revision: 2 }).where(eq(exercises.id, parsed.data.id)).returning({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup, equipment: exercises.equipment, builtin: exercises.builtin, retiredAt: exercises.retiredAt });
  if (!updated) return Response.json({ error: "Exercise not found" }, { status: 404 });
  return Response.json(updated);
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
