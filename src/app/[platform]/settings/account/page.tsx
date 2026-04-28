"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface UserInfo {
  first_name: string;
  last_name: string;
  email: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#2F3941]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] placeholder:text-[#C2C8CC]";

export default function AccountSettingsPage() {
  const [info, setInfo] = useState<UserInfo>({ first_name: "", last_name: "", email: "" });
  const [loading, setLoading] = useState(true);

  // Info form
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSaved, setInfoSaved] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(async data => {
        if (data.userId) {
          // Fetch full user info
          const res = await fetch("/api/auth/me/info");
          if (res.ok) {
            const u = await res.json();
            setInfo({ first_name: u.first_name, last_name: u.last_name, email: u.email });
          }
        }
        setLoading(false);
      });
  }, []);

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInfoError(null);
    setInfoSaving(true);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: info.first_name, last_name: info.last_name, email: info.email }),
    });
    setInfoSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setInfoError(d.error ?? "Something went wrong.");
      return;
    }
    setInfoSaved(true);
    setTimeout(() => setInfoSaved(false), 3000);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    setPwSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPwError(d.error ?? "Something went wrong.");
      return;
    }
    setPwSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPwSaved(false), 3000);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 size={18} className="animate-spin text-[#68717A]" /></div>;
  }

  return (
    <div className="max-w-md space-y-8">
      {/* Personal info */}
      <div>
        <h2 className="text-sm font-semibold text-[#2F3941] mb-4">Personal Information</h2>
        <form onSubmit={handleInfoSubmit} className="space-y-4">
          {infoError && (
            <div className="flex items-center gap-2 text-sm text-[#CC3340] bg-[#FFF0F1] border border-[#FDDCB5] rounded-md px-3 py-2">
              <AlertTriangle size={13} className="shrink-0" />{infoError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <input className={inputCls} value={info.first_name} onChange={e => setInfo(p => ({ ...p, first_name: e.target.value }))} required />
            </Field>
            <Field label="Last Name">
              <input className={inputCls} value={info.last_name} onChange={e => setInfo(p => ({ ...p, last_name: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" className={inputCls} value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} required />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={infoSaving}
              className="inline-flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-60 transition-all"
              style={{ background: "#038153" }}
            >
              {infoSaving && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
            {infoSaved && <span className="inline-flex items-center gap-1.5 text-sm text-[#038153]"><CheckCircle2 size={14} />Saved</span>}
          </div>
        </form>
      </div>

      <div className="border-t border-[#D8DCDE]" />

      {/* Change password */}
      <div>
        <h2 className="text-sm font-semibold text-[#2F3941] mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {pwError && (
            <div className="flex items-center gap-2 text-sm text-[#CC3340] bg-[#FFF0F1] border border-[#FDDCB5] rounded-md px-3 py-2">
              <AlertTriangle size={13} className="shrink-0" />{pwError}
            </div>
          )}
          <Field label="Current Password">
            <input type="password" className={inputCls} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label="New Password">
            <input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" placeholder="Min. 8 characters" />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" className={inputCls} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-60 transition-all"
              style={{ background: "#038153" }}
            >
              {pwSaving && <Loader2 size={13} className="animate-spin" />}
              Update Password
            </button>
            {pwSaved && <span className="inline-flex items-center gap-1.5 text-sm text-[#038153]"><CheckCircle2 size={14} />Updated</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
