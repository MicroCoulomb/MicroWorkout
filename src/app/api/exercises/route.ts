import { asc, isNull } from "drizzle-orm";
import type { Exercise } from "@/domain/types";

export async function GET(request: Request) {
  const [{ auth }, { db }, { exerciseAliases, exercises }] = await Promise.all([import("@/server/auth"), import("@/server/db"), import("@/server/db/schema")]);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const records = await db.select().from(exercises).where(andNotDeleted()).orderBy(asc(exercises.name));
  const aliases = await db.select().from(exerciseAliases);
  return Response.json({ exercises: records.map(serializeExercise), aliases });

  function andNotDeleted() { return isNull(exercises.deletedAt); }
}

function serializeExercise(exercise: { id: string; name: string; muscleGroup: string; equipment: string; builtin: boolean; updatedAt: Date; retiredAt: Date | null }): Exercise {
  return { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup as Exercise["muscleGroup"], equipment: exercise.equipment as Exercise["equipment"], builtin: exercise.builtin, updatedAt: exercise.updatedAt.getTime(), ...(exercise.retiredAt ? { retiredAt: exercise.retiredAt.getTime() } : {}) };
}
