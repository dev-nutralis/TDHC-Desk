"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Mail, Server, UserPlus } from "lucide-react";

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-[#2F3941]">{children}</label>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#68717A]">{children}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE]",
        "focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]",
        "text-[#2F3941] placeholder:text-[#C2C8CC]",
        props.readOnly ? "bg-[#F8F9F9] text-[#68717A] cursor-not-allowed" : "bg-white",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function PasswordInput({
  value, onChange, placeholder, name,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; name?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68717A] hover:text-[#2F3941] transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? "bg-[#038153]" : "bg-[#D8DCDE]"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-[#2F3941]">{label}</span>
    </label>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_secure: boolean;
  imap_host: string;
  imap_port: string;
  imap_user: string;
  imap_pass: string;
  imap_enabled: boolean;
  email_auto_contact_source_id: string;
}

interface SourceOption { id: string; name: string; }

interface Props {
  platformId: string;
  initialConfig: EmailConfig;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-[#EAF7F0] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[#038153]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#2F3941]">{title}</h3>
        <p className="text-xs text-[#68717A] mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailConfigSettingsClient({ platformId, initialConfig }: Props) {
  const [cfg, setCfg] = useState<EmailConfig>(initialConfig);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sources, setSources] = useState<SourceOption[]>([]);

  useEffect(() => {
    fetch("/api/sources")
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setSources(data.map(s => ({ id: s.id, name: s.name }))))
      .catch(() => setSources([]));
  }, []);

  // Test state
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testSmtpResult, setTestSmtpResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingImap, setTestingImap] = useState(false);
  const [testImapResult, setTestImapResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (key: keyof EmailConfig, value: string | boolean) =>
    setCfg(c => ({ ...c, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/platforms/${platformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host:    cfg.smtp_host    || null,
          smtp_port:    cfg.smtp_port    ? Number(cfg.smtp_port) : null,
          smtp_user:    cfg.smtp_user    || null,
          smtp_pass:    cfg.smtp_pass    || null,
          smtp_from:    cfg.smtp_from    || null,
          smtp_secure:  cfg.smtp_secure,
          imap_host:    cfg.imap_host    || null,
          imap_port:    cfg.imap_port    ? Number(cfg.imap_port) : null,
          imap_user:    cfg.imap_user    || null,
          imap_pass:    cfg.imap_pass    || null,
          imap_enabled: cfg.imap_enabled,
          email_auto_contact_source_id: cfg.email_auto_contact_source_id || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    setTestSmtpResult(null);
    try {
      const res = await fetch(`/api/platforms/${platformId}/test-smtp`, { method: "POST" });
      const data = await res.json();
      setTestSmtpResult({ ok: data.ok === true, msg: data.ok ? "Connection successful" : (data.error ?? "Connection failed") });
    } catch {
      setTestSmtpResult({ ok: false, msg: "Connection failed" });
    } finally {
      setTestingSmtp(false);
    }
  };

  const testImap = async () => {
    setTestingImap(true);
    setTestImapResult(null);
    try {
      const res = await fetch(`/api/platforms/${platformId}/test-imap`, { method: "POST" });
      const data = await res.json();
      setTestImapResult({ ok: data.ok === true, msg: data.ok ? "Connection successful" : (data.error ?? "Connection failed") });
    } catch {
      setTestImapResult({ ok: false, msg: "Connection failed" });
    } finally {
      setTestingImap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── SMTP ── */}
      <div className="bg-white rounded-2xl border border-[#D8DCDE] p-6">
        <SectionHeader
          icon={Mail}
          title="Outgoing email (SMTP)"
          description="Used to send emails from the inbox composer and automated messages."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="SMTP Host">
            <Input
              value={cfg.smtp_host}
              onChange={e => set("smtp_host", e.target.value)}
              placeholder="smtp.example.com"
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={cfg.smtp_port}
              onChange={e => set("smtp_port", e.target.value)}
              placeholder="465"
            />
          </Field>
          <Field label="Username">
            <Input
              value={cfg.smtp_user}
              onChange={e => set("smtp_user", e.target.value)}
              placeholder="user@example.com"
            />
          </Field>
          <Field label="Password">
            <PasswordInput
              value={cfg.smtp_pass}
              onChange={v => set("smtp_pass", v)}
              placeholder="••••••••"
              name="smtp_pass"
            />
          </Field>
          <Field label="From address" hint="Displayed as sender — defaults to username if empty">
            <Input
              value={cfg.smtp_from}
              onChange={e => set("smtp_from", e.target.value)}
              placeholder="Name <user@example.com>"
            />
          </Field>
          <Field label="Security">
            <div className="mt-2">
              <Toggle
                checked={cfg.smtp_secure}
                onChange={v => set("smtp_secure", v)}
                label={cfg.smtp_secure ? "SSL/TLS (port 465)" : "STARTTLS (port 587)"}
              />
            </div>
          </Field>
        </div>

        {/* Test SMTP */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={testSmtp}
            disabled={testingSmtp || !cfg.smtp_host}
            className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-lg border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {testingSmtp ? <Loader2 size={12} className="animate-spin" /> : null}
            Test SMTP connection
          </button>
          {testSmtpResult && (
            <div className={`flex items-center gap-1.5 text-xs ${testSmtpResult.ok ? "text-[#038153]" : "text-[#CC3340]"}`}>
              {testSmtpResult.ok
                ? <CheckCircle2 size={13} />
                : <AlertTriangle size={13} />}
              {testSmtpResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── IMAP ── */}
      <div className="bg-white rounded-2xl border border-[#D8DCDE] p-6">
        <SectionHeader
          icon={Server}
          title="Incoming email (IMAP)"
          description="Used to sync received emails into the inbox. Enable to activate periodic sync."
        />
        <div className="mb-5">
          <Toggle
            checked={cfg.imap_enabled}
            onChange={v => set("imap_enabled", v)}
            label="Enable IMAP sync"
          />
        </div>
        <div className={`grid grid-cols-2 gap-4 transition-opacity ${cfg.imap_enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <Field label="IMAP Host">
            <Input
              value={cfg.imap_host}
              onChange={e => set("imap_host", e.target.value)}
              placeholder="imap.example.com"
              disabled={!cfg.imap_enabled}
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={cfg.imap_port}
              onChange={e => set("imap_port", e.target.value)}
              placeholder="993"
              disabled={!cfg.imap_enabled}
            />
          </Field>
          <Field label="Username">
            <Input
              value={cfg.imap_user}
              onChange={e => set("imap_user", e.target.value)}
              placeholder="user@example.com"
              disabled={!cfg.imap_enabled}
            />
          </Field>
          <Field label="Password">
            <PasswordInput
              value={cfg.imap_pass}
              onChange={v => set("imap_pass", v)}
              placeholder="••••••••"
              name="imap_pass"
            />
          </Field>
        </div>

        {/* Test IMAP */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={testImap}
            disabled={testingImap || !cfg.imap_enabled || !cfg.imap_host}
            className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-lg border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {testingImap ? <Loader2 size={12} className="animate-spin" /> : null}
            Test IMAP connection
          </button>
          {testImapResult && (
            <div className={`flex items-center gap-1.5 text-xs ${testImapResult.ok ? "text-[#038153]" : "text-[#CC3340]"}`}>
              {testImapResult.ok
                ? <CheckCircle2 size={13} />
                : <AlertTriangle size={13} />}
              {testImapResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-create contact from unknown senders ── */}
      <div className="bg-white rounded-2xl border border-[#D8DCDE] p-6">
        <SectionHeader
          icon={UserPlus}
          title="Auto-create contacts from inbound email"
          description="When an email arrives from someone who isn't yet a contact, automatically create a contact assigned to the selected source. Leave as 'None' to skip unknown senders."
        />
        <Field label="Source for auto-created contacts" hint="Sources are managed in Settings → Sources.">
          <select
            value={cfg.email_auto_contact_source_id}
            onChange={e => set("email_auto_contact_source_id", e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-all"
          >
            <option value="">None — skip unknown senders</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Save ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-9 px-5 text-sm font-semibold rounded-xl text-white transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "#038153" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save email settings
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-[#038153]">
            <CheckCircle2 size={15} />
            Saved
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-[#CC3340]">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
