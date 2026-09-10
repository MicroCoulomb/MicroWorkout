// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallAppCard } from "./install-app-card";

describe("InstallAppCard", () => {
  afterEach(cleanup);

  it("shows only for the native PWA install prompt and clears after use", async () => {
    render(<InstallAppCard />);
    expect(screen.queryByRole("button", { name: "Install MicroWorkout" })).toBeNull();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    fireEvent(window, event);

    const button = await screen.findByRole("button", { name: "Install MicroWorkout" });
    fireEvent.click(button);

    expect(prompt).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Install MicroWorkout" })).toBeNull());
  });

  it("removes the action after the app is installed", async () => {
    render(<InstallAppCard />);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    fireEvent(window, event);

    await screen.findByRole("button", { name: "Install MicroWorkout" });
    fireEvent(window, new Event("appinstalled"));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Install MicroWorkout" })).toBeNull());
  });
});
