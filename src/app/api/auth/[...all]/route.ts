import { toNextJsHandler } from "better-auth/next-js";
import { authIsConfigured } from "@/server/auth-config";

async function handler(request: Request) {
  if (!authIsConfigured()) return Response.json({ error: "Authentication is not configured" }, { status: 503 });
  const { auth } = await import("@/server/auth");
  return auth.handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
