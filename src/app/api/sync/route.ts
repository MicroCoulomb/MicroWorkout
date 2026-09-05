import { authIsConfigured } from "@/server/auth-config";
import { syncRequestSchema } from "@/server/sync-contract";

export async function POST(request: Request) {
  if (!authIsConfigured()) return Response.json({ error: "Synchronization is not configured" }, { status: 503 });
  const [{ auth }, { synchronize }] = await Promise.all([import("@/server/auth"), import("@/server/sync-service")]);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = syncRequestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid sync payload", details: parsed.error.flatten() }, { status: 400 });
  try { return Response.json(await synchronize(session.user.id, parsed.data)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Synchronization failed" }, { status: 409 }); }
}
