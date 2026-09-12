import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = vi.fn();
  const deleteRecord = vi.fn();
  const eq = vi.fn();
  return {
    auth: { api: { getSession: vi.fn() } },
    db: { transaction },
    transaction,
    deleteRecord,
    eq,
    invitations: { email: "invitations.email" },
    users: { id: "users.id" },
  };
});

vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db", () => ({ db: mocks.db }));
vi.mock("@/server/db/schema", () => ({ invitations: mocks.invitations, users: mocks.users }));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));

import { DELETE } from "./route";

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    mocks.auth.api.getSession.mockResolvedValue({ user: { id: "member-id", email: "member@example.com" } });
    mocks.eq.mockImplementation((column, value) => ({ column, value }));
    mocks.deleteRecord.mockReset();
    mocks.deleteRecord
      .mockReturnValueOnce({ where: vi.fn(async () => undefined) })
      .mockReturnValueOnce({ where: vi.fn(async () => undefined) });
    mocks.transaction.mockImplementation(async (callback) => callback({ delete: mocks.deleteRecord }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("removes the member invitation and account in one transaction", async () => {
    const response = await DELETE(new Request("https://microworkout.test/api/account", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.deleteRecord).toHaveBeenCalledWith(mocks.invitations);
    expect(mocks.deleteRecord).toHaveBeenCalledWith(mocks.users);
    expect(mocks.eq).toHaveBeenCalledWith(mocks.invitations.email, "member@example.com");
    expect(mocks.eq).toHaveBeenCalledWith(mocks.users.id, "member-id");
  });
});
