"use client";

import { ArrowLeft, Plus, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";

interface AccessRecord { id: string; email: string; status: "pending" | "active" | "revoked"; createdAt: string; updatedAt: string; }

export function AdminScreen({ onBack }: { onBack(): void }) {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  async function load() { const response = await fetch("/api/admin/invitations"); if (response.ok) setRecords(await response.json()); else setError("Could not load access records."); }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  async function invite() { const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }); if (response.ok) { setEmail(""); await load(); } else setError("That email could not be invited."); }
  async function changeStatus(id: string, status: "active" | "revoked") { const response = await fetch("/api/admin/invitations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); if (response.ok) await load(); else setError("Access could not be updated."); }
  return <><header className="page-header"><div><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Settings</button><span className="eyebrow">Owner tools</span><h1 className="display">Access<br />admin</h1></div></header><section className="invite-card card"><div><ShieldCheck /><h2 className="display">Invite a user</h2><p>Add the exact verified email they use with Google. MicroWorkout does not send an email.</p></div><div className="invite-form"><label className="field">Google email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="athlete@example.com" /></label><button className="button-primary" disabled={!email.includes("@")} onClick={() => void invite()}><Plus size={18} /> Add access</button></div>{error && <p className="form-error">{error}</p>}</section><section className="access-list"><div className="section-heading"><div><span className="eyebrow">Private membership</span><h2 className="display section-title">Access records</h2></div></div>{records.map((record) => <article className="access-row card" key={record.id}><div><strong>{record.email}</strong><span data-status={record.status}>{record.status}</span></div><time>{new Date(record.updatedAt).toLocaleDateString()}</time>{record.status === "revoked" ? <button className="button-secondary" onClick={() => void changeStatus(record.id, "active")}><RefreshCw size={16} /> Reactivate</button> : <button className="button-danger" onClick={() => void changeStatus(record.id, "revoked")}><UserX size={16} /> Revoke</button>}</article>)}</section></>;
}
