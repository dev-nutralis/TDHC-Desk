"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

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
}

interface FormState {
  name: string;
  website_url: string;
  transcription_language: string;
}

export default function CurrentPlatformSettings() {
  const params = useParams();
  const slug = typeof params?.platform === "string" ? params.platform : null;

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ name: "", website_url: "", transcription_language: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch("/api/platforms")
      .then(r => r.json())
      .then(data => {
        const found: Platform | undefined = (data.platforms ?? []).find((p: Platform) => p.slug === slug);
        if (found) {
          setPlatform(found);
          setForm({
            name: found.name,
            website_url: found.website_url ?? "",
            transcription_language: found.transcription_language ?? "",
          });
        }
        setLoading(false);
      });
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform) return;
    setError(null);
    setSaved(false);
    setSaving(true);

    const res = await fetch(`/api/platforms/${platform.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        website_url: form.website_url || null,
        transcription_language: form.transcription_language || null,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={18} className="animate-spin text-[#68717A]" />
      </div>
    );
  }

  if (!platform) {
    return (
      <div className="text-sm text-[#68717A]">Platform not found.</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      {error && (
        <div className="flex items-center gap-2 text-sm text-[#CC3340] bg-[#FFF0F1] border border-[#FDDCB5] rounded-md px-3 py-2">
          <AlertTriangle size={13} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#2F3941]">
          Name <span className="text-[#CC3340]">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          required
          className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941]"
        />
      </div>

      {/* Slug — read-only */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#2F3941]">Slug</label>
        <input
          type="text"
          value={platform.slug}
          readOnly
          className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] bg-[#F8F9F9] text-[#68717A] cursor-not-allowed"
        />
        <p className="text-[11px] text-[#68717A]">Slug cannot be changed after creation.</p>
      </div>

      {/* Website URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#2F3941]">Website URL</label>
        <input
          type="url"
          value={form.website_url}
          onChange={e => setForm(prev => ({ ...prev, website_url: e.target.value }))}
          placeholder="https://example.com"
          className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] placeholder:text-[#C2C8CC]"
        />
      </div>

      {/* Transcription Language */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#2F3941]">Transcription Language</label>
        <select
          value={form.transcription_language}
          onChange={e => setForm(prev => ({ ...prev, transcription_language: e.target.value }))}
          className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] bg-white"
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-[#68717A]">Language used for AI call transcription. Auto-detect works for most cases.</p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-60 transition-all"
          style={{ background: "#038153" }}
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Save Changes
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[#038153]">
            <CheckCircle2 size={14} />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
