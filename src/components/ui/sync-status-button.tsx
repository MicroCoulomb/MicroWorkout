"use client";

import { Cloud, CloudOff } from "lucide-react";
import { useWorkoutStore } from "@/features/workouts/workout-store";

export function SyncStatusButton() {
  const { pendingChanges, syncNow, syncStatus } = useWorkoutStore();
  const Icon = syncStatus === "synced" ? Cloud : CloudOff;
  const label = syncStatus === "local" ? "Local demo"
    : syncStatus === "synced" ? "Synced"
      : syncStatus === "syncing" ? "Syncing"
        : syncStatus === "offline" ? `${pendingChanges} pending`
          : syncStatus === "locked" ? "Sign in again"
            : "Retry sync";

  return <button className="sync-pill" onClick={() => void syncNow()}><Icon size={14} /> {label}</button>;
}
