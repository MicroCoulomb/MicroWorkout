"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { MicroWorkoutApp } from "./micro-workout-app";

interface LastUser { id: string; name: string; verifiedAt: number; }

export function OfflineEntry() {
  const [user, setUser] = useState<LastUser | null>();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("microworkout-last-user");
      const parsed = stored ? JSON.parse(stored) as LastUser : null;
      setUser(parsed && Date.now() - parsed.verifiedAt <= 7 * 24 * 60 * 60 * 1000 ? parsed : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (user === undefined) return null;
  if (!user) return <main className="offline-lock"><WifiOff /><h1 className="display">Connect to<br />sign in.</h1><p>MicroWorkout needs to verify this device online before private cached data can be opened.</p></main>;
  return <MicroWorkoutApp userId={user.id} userName={user.name} syncEnabled />;
}
