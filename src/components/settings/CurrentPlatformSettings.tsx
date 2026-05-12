"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2, Wifi, WifiOff, Eye, EyeOff } from "lucide-react";

const LANGUAGES = [
  { value: "", label: "Auto-detect" },
  { value: "Slovenian", label: "Slovenian (sl)" },
  { value: "Serbian", label: "Serbian (sr)" },
  { value: "Croatian", label: "Croatian (hr)" },
  { value: "Bosnian", label: "Bosnian (bs)" },
  { value: "English", label: "English (en)" },
  { value: "German", label: "German (de)" },
  { value: "Italian", label: "Italian (it)" },
  { value: "French", label: "French (fr)" },
  { value: "Spanish", label: "Spanish (es)" },
  { value: "Hungarian", label: "Hungarian (hu)" },
  { value: "Romanian", label: "Romanian (ro)" },
];

interface Platform {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  transcription_language: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from: string | null;
  smtp_secure: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_pass: string | null;
  imap_enabled: boolean;
}

// ── Shared field ──────────────────────────────────────────────────────────────

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#2F3941]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#68717A]">{hint}</p>}
    </div>
  );
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
        value={value}
        name={name}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68717A] hover:text-[#2F3941] transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

type TestState = "idle" | "testing" | "ok" | "error";

function TestBadge({ state, error }: { state: TestState; error?: string }) {
  if (state === "idle") return null;
  if (state === "testing") return (
    <span className="flex items-center gap-1.5 text-xs text-[#68717A]">
      <Loader2 size={12} className="animate-spin" /> Testing...
    </span>
  );
  if (state === "ok") return (
    <span className="flex items-center gap-1.5 text-xs text-[#038153]">
      <Wifi size={13} /> Connected
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#CC3340]" title={error}>
      <WifiOff size={13} /> {error ? error.slice(0, 60) : "Failed"}
    </span>
  );
}

function SaveRow({
  saving, saved, error, onSubmit, children,
}: {
  saving: boolean; saved: boolean; error: string | null;
  onSubmit: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pt-1 flex-wrap">
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="inline-flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-60 transition-all"
        style={{ background: "#038153" }}
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Save Changes
      </button>
      {children}
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-sm text-[#038153]">
          <CheckCircle2 size={14} /> Saved
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-xs text-[#CC3340]">
          <AlertTriangle size={12} /> {error}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CurrentPlatformSettings() {
  const params = useParams();
  const slug = typeof params?.platform === "string" ? params.platform : null;

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [loading, setLoading]   = useState(true);

  // General form
  const [general, setGeneral] = useState({ name: "", website_url: "", transcription_language: "" });
  const [genSaving, setGenSaving] = useState(false);
  const [genSaved,  setGenSaved]  = useState(false);
  const [genError,  setGenError]  = useState<string | null>(null);

  // SMTP form
  const [smtp, setSmtp] = useState({
    smtp_host: "", smtp_port: "465", smtp_user: "",
    smtp_pass: "", smtp_from: "", smtp_secure: true,
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSaved,  setSmtpSaved]  = useState(false);
  const [smtpError,  setSmtpError]  = useState<string | null>(null);
  const [smtpTest,   setSmtpTest]   = useState<TestState>("idle");
  const [smtpTestErr, setSmtpTestErr] = useState<string | undefined>();

  // IMAP form
  const [imap, setImap] = useState({
    imap_host: "", imap_port: "993", imap_user: "", imap_pass: "", imap_enabled: false,
  });
  const [imapSaving, setImapSaving] = useState(false);
  const [imapSaved,  setImapSaved]  = useState(false);
  const [imapError,  setImapError]  = useState<string | null>(null);
  const [imapTest,   setImapTest]   = useState<TestState>("idle");
  const [imapTestErr, setImapTestErr] = useState<string | undefined>();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch("/api/platforms")
      .then(r => r.json())
      .then(async data => {
        const found: Platform | undefined = (data.platforms ?? []).find((p: Platform) => p.slug === slug);
        if (!found) { setLoading(false); return; }
        // Fetch full platform (includes sensitive email config)
        const full: Platform = await fetch(`/api/platforms/${found.id}`).then(r => r.json());
        setPlatform(full);
        setGeneral({
          name: full.name,
          website_url: full.website_url ?? "",
          transcription_language: full.transcription_language ?? "",
        });
        setSmtp({
          smtp_host:   full.smtp_host   ?? "",
          smtp_port:   String(full.smtp_port ?? 465),
          smtp_user:   full.smtp_user   ?? "",
          smtp_pass:   full.smtp_pass   ?? "",
          smtp_from:   full.smtp_from   ?? "",
          smtp_secure: full.smtp_secure ?? true,
        });
        setImap({
          imap_host:    full.imap_host    ?? "",
          imap_port:    String(full.imap_port ?? 993),
          imap_user:    full.imap_user    ?? "",
          imap_pass:    full.imap_pass    ?? "",
          imap_enabled: full.imap_enabled ?? false,
        });
        setLoading(false);
      });
  }, [slug]);

  const patch = async (data: Record<string, unknown>) => {
    if (!platform) throw new Error("No platform");
    const res = await fetch(`/api/platforms/${platform.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
  };

  const flashSaved = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 3000);
  };

  const saveGeneral = async () => {
    setGenError(null); setGenSaving(true);
    try {
      await patch({
        name: general.name,
        website_url: general.website_url || null,
        transcription_language: general.transcription_language || null,
      });
      flashSaved(setGenSaved);
    } catch (e) { setGenError(e instanceof Error ? e.message : "Error"); }
    finally { setGenSaving(false); }
  };

  const saveSmtp = async () => {
    setSmtpError(null); setSmtpSaving(true);
    try {
      await patch({
        smtp_host:   smtp.smtp_host   || null,
        smtp_port:   smtp.smtp_port   ? Number(smtp.smtp_port)   : null,
        smtp_user:   smtp.smtp_user   || null,
        smtp_pass:   smtp.smtp_pass   || null,
        smtp_from:   smtp.smtp_from   || null,
        smtp_secure: smtp.smtp_secure,
      });
      flashSaved(setSmtpSaved);
    } catch (e) { setSmtpError(e instanceof Error ? e.message : "Error"); }
    finally { setSmtpSaving(false); }
  };

  const saveImap = async () => {
    setImapError(null); setImapSaving(true);
    try {
      await patch({
        imap_host:    imap.imap_host    || null,
        imap_port:    imap.imap_port    ? Number(imap.imap_port)    : null,
        imap_user:    imap.imap_user    || null,
        imap_pass:    imap.imap_pass    || null,
        imap_enabled: imap.imap_enabled,
      });
      flashSaved(setImapSaved);
    } catch (e) { setImapError(e instanceof Error ? e.message : "Error"); }
    finally { setImapSaving(false); }
  };

  const testSmtp = async () => {
    if (!platform) return;
    setSmtpTest("testing"); setSmtpTestErr(undefined);
    try {
      const res = await fetch(`/api/platforms/${platform.id}/test-smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host:   smtp.smtp_host,
          smtp_port:   Number(smtp.smtp_port),
          smtp_user:   smtp.smtp_user,
          smtp_pass:   smtp.smtp_pass,
          smtp_secure: smtp.smtp_secure,
        }),
      });
      const data = await res.json();
      if (data.ok) { setSmtpTest("ok"); }
      else { setSmtpTest("error"); setSmtpTestErr(data.error); }
    } catch (e) {
      setSmtpTest("error");
      setSmtpTestErr(e instanceof Error ? e.message : "Error");
    }
  };

  const testImap = async () => {
    if (!platform) return;
    setImapTest("testing"); setImapTestErr(undefined);
    try {
      const res = await fetch(`/api/platforms/${platform.id}/test-imap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imap_host: imap.imap_host,
          imap_port: Number(imap.imap_port),
          imap_user: imap.imap_user,
          imap_pass: imap.imap_pass,
        }),
      });
      const data = await res.json();
      if (data.ok) { setImapTest("ok"); }
      else { setImapTest("error"); setImapTestErr(data.error); }
    } catch (e) {
      setImapTest("error");
      setImapTestErr(e instanceof Error ? e.message : "Error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={18} className="animate-spin text-[#68717A]" />
      </div>
    );
  }

  if (!platform) {
    return <div className="text-sm text-[#68717A]">Platform not found.</div>;
  }

  const cardClass = "bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-6 space-y-5";
  const sectionTitle = "text-sm font-semibold text-[#2F3941] mb-4";
  const sectionHint  = "text-xs text-[#68717A] mt-0.5 mb-4";

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── General ──────────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <p className={sectionTitle}>General</p>

        <Field label="Name *">
          <Input
            type="text"
            value={general.name}
            onChange={e => setGeneral(p => ({ ...p, name: e.target.value }))}
            required
          />
        </Field>

        <Field label="Slug" hint="Slug cannot be changed after creation.">
          <Input type="text" value={platform.slug} readOnly />
        </Field>

        <Field label="Website URL">
          <Input
            type="url"
            value={general.website_url}
            onChange={e => setGeneral(p => ({ ...p, website_url: e.target.value }))}
            placeholder="https://example.com"
          />
        </Field>

        <Field label="Transcription Language" hint="Language used for AI call transcription.">
          <select
            value={general.transcription_language}
            onChange={e => setGeneral(p => ({ ...p, transcription_language: e.target.value }))}
            className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] bg-white"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>

        <SaveRow saving={genSaving} saved={genSaved} error={genError} onSubmit={saveGeneral} />
      </div>

      {/* ── SMTP ─────────────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div>
          <p className={sectionTitle}>Email — Outbound (SMTP)</p>
          <p className={sectionHint}>Used for sending emails from this platform.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="SMTP Host">
            <Input
              type="text"
              value={smtp.smtp_host}
              onChange={e => setSmtp(p => ({ ...p, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
            />
          </Field>
          <Field label="SMTP Port">
            <Input
              type="number"
              value={smtp.smtp_port}
              onChange={e => setSmtp(p => ({ ...p, smtp_port: e.target.value }))}
              placeholder="465"
            />
          </Field>
        </div>

        <Field label="SMTP Username">
          <Input
            type="email"
            value={smtp.smtp_user}
            onChange={e => setSmtp(p => ({ ...p, smtp_user: e.target.value }))}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="SMTP Password">
          <PasswordInput
            value={smtp.smtp_pass}
            onChange={v => setSmtp(p => ({ ...p, smtp_pass: v }))}
            placeholder="App password or SMTP password"
            name="smtp_pass"
          />
        </Field>

        <Field label="From Address" hint="Displayed as sender. Defaults to SMTP Username if empty.">
          <Input
            type="email"
            value={smtp.smtp_from}
            onChange={e => setSmtp(p => ({ ...p, smtp_from: e.target.value }))}
            placeholder="info@example.com"
          />
        </Field>

        <div className="flex items-center gap-2">
          <input
            id="smtp_secure"
            type="checkbox"
            checked={smtp.smtp_secure}
            onChange={e => setSmtp(p => ({ ...p, smtp_secure: e.target.checked }))}
            className="w-4 h-4 rounded border-[#D8DCDE] accent-[#038153]"
          />
          <label htmlFor="smtp_secure" className="text-sm text-[#2F3941]">Use SSL/TLS (port 465)</label>
        </div>

        <SaveRow saving={smtpSaving} saved={smtpSaved} error={smtpError} onSubmit={saveSmtp}>
          <button
            type="button"
            onClick={testSmtp}
            disabled={smtpTest === "testing" || !smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            {smtpTest === "testing" && <Loader2 size={13} className="animate-spin" />}
            Test Connection
          </button>
          <TestBadge state={smtpTest} error={smtpTestErr} />
        </SaveRow>
      </div>

      {/* ── IMAP ─────────────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div>
          <p className={sectionTitle}>Email — Inbound (IMAP)</p>
          <p className={sectionHint}>
            Polls the inbox every 60 seconds and imports emails from known contacts into the activity feed.
          </p>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <input
            id="imap_enabled"
            type="checkbox"
            checked={imap.imap_enabled}
            onChange={e => setImap(p => ({ ...p, imap_enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-[#D8DCDE] accent-[#038153]"
          />
          <label htmlFor="imap_enabled" className="text-sm font-medium text-[#2F3941]">Enable IMAP polling</label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="IMAP Host">
            <Input
              type="text"
              value={imap.imap_host}
              onChange={e => setImap(p => ({ ...p, imap_host: e.target.value }))}
              placeholder="imap.gmail.com"
              disabled={!imap.imap_enabled}
            />
          </Field>
          <Field label="IMAP Port">
            <Input
              type="number"
              value={imap.imap_port}
              onChange={e => setImap(p => ({ ...p, imap_port: e.target.value }))}
              placeholder="993"
              disabled={!imap.imap_enabled}
            />
          </Field>
        </div>

        <Field label="IMAP Username">
          <Input
            type="email"
            value={imap.imap_user}
            onChange={e => setImap(p => ({ ...p, imap_user: e.target.value }))}
            placeholder="you@example.com"
            disabled={!imap.imap_enabled}
          />
        </Field>

        <Field label="IMAP Password">
          <PasswordInput
            value={imap.imap_pass}
            onChange={v => setImap(p => ({ ...p, imap_pass: v }))}
            placeholder="App password or IMAP password"
            name="imap_pass"
          />
        </Field>

        <SaveRow saving={imapSaving} saved={imapSaved} error={imapError} onSubmit={saveImap}>
          <button
            type="button"
            onClick={testImap}
            disabled={imapTest === "testing" || !imap.imap_host || !imap.imap_user || !imap.imap_pass}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] text-[#2F3941] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            {imapTest === "testing" && <Loader2 size={13} className="animate-spin" />}
            Test Connection
          </button>
          <TestBadge state={imapTest} error={imapTestErr} />
        </SaveRow>
      </div>

    </div>
  );
}
