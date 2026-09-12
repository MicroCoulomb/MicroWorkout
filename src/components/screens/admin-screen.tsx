"use client";

import { ArrowLeft, Plus, RefreshCw, UserX } from "lucide-react";
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
  return <div className="access-admin-screen">
    <header className="page-header access-admin-header"><h1 className="page-title">Access admin</h1><button className="icon-button" aria-label="Back to Settings" onClick={onBack}><ArrowLeft size={18} /></button></header>
    <section className="invite-card card"><div><h2 className="display">Invite a User</h2></div><div className="invite-form"><label className="field">Google email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="athlete@example.com" /></label><button className="button-primary" disabled={!email.includes("@")} onClick={() => void invite()}><Plus size={18} /> Add access</button></div>{error && <p className="form-error">{error}</p>}</section>
    <section className="access-list" aria-label="Members"><span className="eyebrow">Members</span><div className="access-records">{records.map((record) => <article className="access-row card" key={record.id}><div className="access-member"><strong title={record.email}>{record.email}</strong><span data-status={record.status}>{record.status}</span></div><time>{new Date(record.updatedAt).toLocaleDateString()}</time>{record.status === "revoked" ? <button className="icon-action" aria-label={`Reactivate ${record.email}`} onClick={() => void changeStatus(record.id, "active")}><RefreshCw size={16} /></button> : <button className="icon-action icon-action-danger" aria-label={`Revoke ${record.email}`} onClick={() => void changeStatus(record.id, "revoked")}><UserX size={16} /></button>}</article>)}</div></section>
  </div>;
}
