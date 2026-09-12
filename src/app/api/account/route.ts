import { eq } from "drizzle-orm";

export async function DELETE(request: Request) {
  const [{ auth }, { db }, { invitations, users }] = await Promise.all([import("@/server/auth"), import("@/server/db"), import("@/server/db/schema")]);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user.email.trim().toLowerCase();
  if (email === process.env.OWNER_EMAIL?.trim().toLowerCase()) return Response.json({ error: "Owner account is protected" }, { status: 409 });
  await db.transaction(async (tx) => {
    await tx.delete(invitations).where(eq(invitations.email, email));
    await tx.delete(users).where(eq(users.id, session.user.id));
  });
  return Response.json({ deleted: true });
}
