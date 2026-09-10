"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();

  useEffect(() => {
    function saveInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function clearInstallPrompt() {
      setInstallPrompt(undefined);
    }

    window.addEventListener("beforeinstallprompt", saveInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", saveInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  async function installApp() {
    const prompt = installPrompt;
    if (!prompt) return;

    setInstallPrompt(undefined);
    await prompt.prompt();
    await prompt.userChoice;
  }

  if (!installPrompt) return null;

  return (
    <section className="settings-card install-card card">
      <Download />
      <span className="eyebrow">Install the app</span>
      <h2 className="display">Train without the browser</h2>
      <p>Install MicroWorkout for a focused, full-screen workout space from your home screen.</p>
      <button className="button-primary" onClick={() => void installApp()}>
        <Download size={18} /> Install MicroWorkout
      </button>
    </section>
  );
}
