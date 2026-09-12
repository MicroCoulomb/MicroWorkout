// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminScreen } from "./admin-screen";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), onBack: vi.fn() }));

describe("AdminScreen", () => {
  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.onBack.mockClear();
    mocks.fetch.mockImplementation(async () => Response.json([
      { id: "member", email: "very-long-member-address-that-must-not-overlap-actions@example.com", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(cleanup);

  it("keeps the invite panel outside the independently structured member records", async () => {
    render(<AdminScreen onBack={mocks.onBack} />);

    expect(screen.queryByText("Access records")).toBeNull();
    expect(screen.getByText("Members")).toBeTruthy();
    expect((await screen.findByText(/very-long-member-address/)).closest(".access-records")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke very-long-member-address-that-must-not-overlap-actions@example.com" }).textContent).toBe("");
  });

  it("uses the compact title-row back button", () => {
    render(<AdminScreen onBack={mocks.onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to Settings" }));
    expect(mocks.onBack).toHaveBeenCalledOnce();
  });

  it("requires confirmation before revoking access", async () => {
    render(<AdminScreen onBack={mocks.onBack} />);

    fireEvent.click(await screen.findByRole("button", { name: "Revoke very-long-member-address-that-must-not-overlap-actions@example.com" }));
    expect(screen.getByRole("alertdialog", { name: "Revoke member?" })).toBeTruthy();
    expect(mocks.fetch).toHaveBeenCalledOnce();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  });
});
