"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Pencil, Loader2, X, Globe, Building2, ExternalLink, AlertTriangle,
} from "lucide-react";

interface Platform {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  created_at: string;
}

interface FormState {
  name: string;
  slug: string;
  logo_url: string;
  website_url: string;
}

const EMPTY_FORM: FormState = { name: "", slug: "", logo_url: "", website_url: "" };

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface PlatformModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  platform: Platform | null; // null = create mode
}

function PlatformModal({ open, onClose, onSaved, platform }: PlatformModalProps) {
  const isEdit = !!platform;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (open) {
      if (platform) {
        setForm({
          name: platform.name,
          slug: platform.slug,
          logo_url: platform.logo_url ?? "",
          website_url: platform.website_url ?? "",
        });
        setSlugTouched(true);
      } else {
        setForm(EMPTY_FORM);
        setSlugTouched(false);
      }
      setError(null);
    }
  }, [open, platform]);

  const handleNameChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      name: value,
      slug: slugTouched ? prev.slug : slugify(value),
    }));
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setForm(prev => ({ ...prev, slug: slugify(value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const url = isEdit ? `/api/platforms/${platform!.id}` : "/api/platforms";
    const method = isEdit ? "PATCH" : "POST";

    const body = isEdit
      ? { name: form.name, logo_url: form.logo_url || null, website_url: form.website_url || null }
      : { name: form.name, slug: form.slug, logo_url: form.logo_url || null, website_url: form.website_url || null };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#EAF7F0] flex items-center justify-center">
              <Building2 size={15} className="text-[#038153]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">
              {isEdit ? "Edit Platform" : "New Platform"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form id="platform-form" onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
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
              onChange={e => handleNameChange(e.target.value)}
              required
              placeholder="e.g. Acme Corp"
              className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] placeholder:text-[#C2C8CC]"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#2F3941]">
              Slug <span className="text-[#CC3340]">*</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={e => handleSlugChange(e.target.value)}
              required
              readOnly={isEdit}
              placeholder="e.g. acme-corp"
              className={[
                "w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none text-[#2F3941] placeholder:text-[#C2C8CC]",
                isEdit
                  ? "bg-[#F8F9F9] text-[#68717A] cursor-not-allowed"
                  : "focus:border-[#038153] focus:ring-1 focus:ring-[#038153]",
              ].join(" ")}
            />
            {!isEdit && (
              <p className="text-[11px] text-[#68717A]">
                Lowercase letters, numbers, and hyphens only. Cannot be changed later.
              </p>
            )}
          </div>

          {/* Logo URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#2F3941]">Logo URL</label>
            <input
              type="url"
              value={form.logo_url}
              onChange={e => setForm(prev => ({ ...prev, logo_url: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] placeholder:text-[#C2C8CC]"
            />
          </div>

          {/* Website URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#2F3941]">Website URL</label>
            <input
              type="url"
              value={form.website_url}
              onChange={e => setForm(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://example.com"
              className="w-full h-8 px-3 text-sm rounded-md border border-[#D8DCDE] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] text-[#2F3941] placeholder:text-[#C2C8CC]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="platform-form"
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded-md text-white hover:brightness-110 disabled:opacity-60 transition-all"
            style={{ background: "#038153" }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Create Platform"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PlatformSettingsManager() {
  const params = useParams();
  const router = useRouter();
  const currentSlug = typeof params?.platform === "string" ? params.platform : null;

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlatform, setEditPlatform] = useState<Platform | null>(null);

  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/platforms");
    const data = await res.json();
    setPlatforms(data.platforms ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]);

  const openCreate = () => {
    setEditPlatform(null);
    setModalOpen(true);
  };

  const openEdit = (platform: Platform) => {
    setEditPlatform(platform);
    setModalOpen(true);
  };

  const handleSwitch = (slug: string) => {
    router.push(`/${slug}/leads`);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-white hover:brightness-110 transition-all"
          style={{ background: "#038153" }}
        >
          <Plus size={14} /> New Platform
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border border-[#D8DCDE] overflow-hidden shadow-sm">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={18} className="animate-spin text-[#68717A]" />
          </div>
        )}

        {!loading && platforms.length === 0 && (
          <div className="flex flex-col items-center gap-2 h-40 justify-center text-[#68717A]">
            <Building2 size={28} strokeWidth={1.2} />
            <p className="text-sm font-medium">No platforms yet.</p>
            <p className="text-xs text-[#C2C8CC]">Create your first platform to get started.</p>
          </div>
        )}

        {!loading && platforms.map((platform, idx) => {
          const isCurrent = platform.slug === currentSlug;

          return (
            <div
              key={platform.id}
              className={[
                "flex items-center gap-3 px-4 py-3 transition-colors group",
                idx < platforms.length - 1 ? "border-b border-[#D8DCDE]" : "",
                "hover:bg-[#F8F9F9]",
              ].join(" ")}
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-md bg-[#F3F4F6] border border-[#D8DCDE] flex items-center justify-center shrink-0 overflow-hidden">
                {platform.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={platform.logo_url} alt={platform.name} className="w-full h-full object-contain" />
                ) : (
                  <Building2 size={14} className="text-[#68717A]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleSwitch(platform.slug)}
                    className="text-sm font-semibold text-[#2F3941] hover:text-[#038153] hover:underline transition-colors"
                  >
                    {platform.name}
                  </button>
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EAF7F0] border border-[#B7E5D0] text-[#038153] font-semibold">
                      Current
                    </span>
                  )}
                  <span className="text-[11px] text-[#68717A] font-mono bg-[#F3F4F6] px-1.5 py-0.5 rounded border border-[#D8DCDE]">
                    {platform.slug}
                  </span>
                </div>
                {platform.website_url && (
                  <a
                    href={platform.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#68717A] hover:text-[#038153] mt-0.5 transition-colors"
                  >
                    <Globe size={10} />
                    {platform.website_url}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Switch button — visible on hover when not current */}
                {!isCurrent && (
                  <button
                    onClick={() => handleSwitch(platform.slug)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ExternalLink size={11} /> Switch
                  </button>
                )}
                <button
                  onClick={() => openEdit(platform)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit platform"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <PlatformModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchPlatforms}
        platform={editPlatform}
      />
    </div>
  );
}
