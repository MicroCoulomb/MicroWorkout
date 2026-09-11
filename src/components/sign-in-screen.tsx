"use client";

import Image from "next/image";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInScreen() {
  const [loading, setLoading] = useState(false);
  return <main className="signin-shell signin-login"><div className="signin-brand brand display"><span>Micro</span>Workout</div><section className="signin-card signin-login-card"><Image className="signin-logo" src="/icon-orange.png" alt="MicroWorkout" width={1536} height={1024} priority /><h1 className="display">Sign in</h1><p className="signin-note">MicroWorkout is invite-only. Continue with the Google account your administrator approved.</p><button className="signin-google-button" disabled={loading} onClick={async () => {
    setLoading(true);
    try { await authClient.signIn.social({ provider: "google", callbackURL: "/" }); }
    finally { setLoading(false); }
  }}><GoogleMark />{loading ? "Opening Google…" : "Continue with Google"}</button></section></main>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.8 12.23c0-.72-.06-1.25-.2-1.8H12v3.42h5.64c-.11.85-.7 2.13-2.02 2.99l-.02.11 2.93 2.27.2.02c1.85-1.7 3.07-4.21 3.07-7.01Z" /><path fill="#34A853" d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.22-2.5c-.86.6-2.01 1.02-3.55 1.02a6.13 6.13 0 0 1-5.79-4.24l-.1.01-3.04 2.36-.03.1A10.23 10.23 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.21 13.81A6.27 6.27 0 0 1 5.87 12c0-.63.12-1.24.33-1.81v-.12L3.13 7.68l-.1.05A10.15 10.15 0 0 0 1.95 12c0 1.54.37 3 .99 4.27l3.27-2.46Z" /><path fill="#EA4335" d="M12 5.95c1.95 0 3.27.84 4.02 1.55l2.93-2.86C17.07 2.9 14.76 2 12 2a10.23 10.23 0 0 0-8.97 5.73l3.18 2.46A6.13 6.13 0 0 1 12 5.95Z" /></svg>;
}

export function ConfigurationScreen() {
  return <main className="signin-shell"><section className="signin-copy"><div className="brand display"><span>Micro</span>Workout</div><span className="eyebrow">Deployment setup</span><h1 className="display">Almost ready<br />to move.</h1><p>Add the required Neon, Better Auth, Google OAuth, and owner environment values, then restart the application.</p></section><section className="signin-card"><h2 className="display">Configuration required</h2><p>Copy <code>.env.example</code> to <code>.env.local</code> and replace every placeholder. The app does not enable an insecure production fallback.</p></section></main>;
}
