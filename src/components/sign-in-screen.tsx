"use client";

import { ArrowRight, Dumbbell } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInScreen() {
  const [loading, setLoading] = useState(false);
  return <main className="signin-shell"><section className="signin-copy"><div className="brand display"><span>Micro</span>Workout</div><span className="eyebrow">Private training log</span><h1 className="display">Small sets.<br />Serious momentum.</h1><p>Plan your rotation, stay honest through every rest, and keep your training history with you—even offline.</p></section><section className="signin-card"><div className="signin-icon"><Dumbbell /></div><h2 className="display">Welcome in.</h2><p>MicroWorkout is invite-only. Continue with the Google account your administrator approved.</p><button className="button-primary" disabled={loading} onClick={async () => {
    setLoading(true);
    try {
      const result: any = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      // Some client implementations redirect immediately; if a URL is returned, navigate to it.
      if (result && typeof result === "object" && typeof result.url === "string") {
        window.location.href = result.url;
        return;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Social sign-in failed, falling back to auth endpoint:", err);
      try {
        // Fallback: navigate to auth catch-all route with a provider query param.
        window.location.href = `/api/auth?provider=google`;
        return;
      } catch (navErr) {
        // eslint-disable-next-line no-console
        console.error("Fallback navigation failed:", navErr);
      }
    } finally { setLoading(false); }
  }}>{loading ? "Opening Google…" : "Continue with Google"}<ArrowRight /></button></section></main>;
}

export function ConfigurationScreen() {
  return <main className="signin-shell"><section className="signin-copy"><div className="brand display"><span>Micro</span>Workout</div><span className="eyebrow">Deployment setup</span><h1 className="display">Almost ready<br />to move.</h1><p>Add the required Neon, Better Auth, Google OAuth, and owner environment values, then restart the application.</p></section><section className="signin-card"><h2 className="display">Configuration required</h2><p>Copy <code>.env.example</code> to <code>.env.local</code> and replace every placeholder. The app does not enable an insecure production fallback.</p></section></main>;
}
