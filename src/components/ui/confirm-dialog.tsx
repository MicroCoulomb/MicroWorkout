"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onClose(): void;
  onConfirm(): void | Promise<void>;
}

export function ConfirmDialog({ title, message, confirmLabel, tone = "primary", onClose, onConfirm }: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function confirm() {
    setConfirming(true);
    await onConfirm();
    onClose();
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !confirming && onClose()}>
    <section className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <div className="dialog-mark"><AlertTriangle size={23} /></div>
      <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
      <span className="eyebrow">Confirm action</span>
      <h2 id="confirm-dialog-title" className="display">{title}</h2>
      <p id="confirm-dialog-message">{message}</p>
      <div className="dialog-actions">
        <button className="button-secondary" disabled={confirming} onClick={onClose}>Cancel</button>
        <button className={tone === "danger" ? "button-danger" : "button-primary"} disabled={confirming} onClick={() => void confirm()}>{confirming ? "Saving…" : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
