import { desc, eq } from "drizzle-orm";
import { z } from "zod";

async function requireAdmin(request: Request) {
  const [{ auth }, { db }] = await Promise.all([import("@/server/auth"), import("@/server/db")]);
  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user && "role" in session.user ? session.user.role : "user";
  if (!session || role !== "admin") return null;
  return { session, db };
}

export async function GET(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { invitations } = await import("@/server/db/schema");
  return Response.json(await context.db.select({ id: invitations.id, email: invitations.email, status: invitations.status, createdAt: invitations.createdAt, updatedAt: invitations.updatedAt }).from(invitations).orderBy(desc(invitations.updatedAt)));
}

export async function POST(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ email: z.email() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Valid email required" }, { status: 400 });
  const { invitations } = await import("@/server/db/schema");
  const email = parsed.data.email.trim().toLowerCase();
  const [record] = await context.db.insert(invitations).values({ email, status: "pending", invitedByUserId: context.session.user.id }).onConflictDoUpdate({ target: invitations.email, set: { status: "pending", invitedByUserId: context.session.user.id, updatedAt: new Date() } }).returning({ id: invitations.id, email: invitations.email, status: invitations.status });
  return Response.json(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireAdmin(request);
  if (!context) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ id: z.uuid(), status: z.enum(["active", "revoked"]) }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid access update" }, { status: 400 });
  const { authSessions, invitations, users } = await import("@/server/db/schema");
  const [record] = await context.db.select().from(invitations).where(eq(invitations.id, parsed.data.id)).limit(1);
  if (!record) return Response.json({ error: "Access record not found" }, { status: 404 });
  if (record.email === process.env.OWNER_EMAIL?.trim().toLowerCase()) return Response.json({ error: "Owner access is protected" }, { status: 409 });
  await context.db.transaction(async (tx) => {
    await tx.update(invitations).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(invitations.id, record.id));
    if (record.acceptedByUserId) {
      await tx.update(users).set({ banned: parsed.data.status === "revoked", banReason: parsed.data.status === "revoked" ? "Access revoked" : null, updatedAt: new Date() }).where(eq(users.id, record.acceptedByUserId));
      if (parsed.data.status === "revoked") await tx.delete(authSessions).where(eq(authSessions.userId, record.acceptedByUserId));
    }
  });
  return Response.json({ id: record.id, status: parsed.data.status });
}
