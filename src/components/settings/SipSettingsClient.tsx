"use client";

import { useState } from "react";
import { Save, Phone, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  initialData: {
    extension: string;
    sipUser: string;
    wssHost: string;
    enabled: boolean;
  } | null;
};

export function SipSettingsClient({ initialData }: Props) {
  const [extension, setExtension] = useState(initialData?.extension ?? "");
  const [sipUser, setSipUser] = useState(initialData?.sipUser ?? "");
  const [sipPass, setSipPass] = useState("");
  const [wssHost, setWssHost] = useState(
    initialData?.wssHost ?? process.env.NEXT_PUBLIC_YEASTAR_WSS_HOST ?? ""
  );
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!extension || !sipUser || !wssHost) {
      setError("Extension, SIP User, and WSS Host are required");
      return;
    }
    if (!initialData && !sipPass) {
      setError("SIP Password is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/sip-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension,
          sipUser,
          sipPass: sipPass || undefined,
          wssHost,
          enabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      setSaved(true);
      setSipPass("");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-[#EAF7F0] flex items-center justify-center">
          <Phone size={17} className="text-[#038153]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#2F3941]">SIP Phone Configuration</h2>
          <p className="text-xs text-[#68717A]">Configure your Yeastar PBX connection for browser calling</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EB] p-6 space-y-5">
        {/* Enabled toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#2F3941]">Enable SIP Phone</p>
            <p className="text-xs text-[#68717A]">Activate browser-based calling</p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{ background: enabled ? "#038153" : "#D8DCDE" }}
            className="relative w-10 h-5 rounded-full transition-colors shrink-0 overflow-hidden"
          >
            <span
              style={{ transform: enabled ? "translateX(20px)" : "translateX(2px)" }}
              className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            />
          </button>
        </div>

        <div className="border-t border-[#F3F4F6]" />

        {/* Extension */}
        <div>
          <label className="block text-sm font-medium text-[#2F3941] mb-1.5">Extension</label>
          <input
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            placeholder="e.g. 1001"
            className="w-full px-3 py-2 border border-[#D8DCDE] rounded-lg text-sm text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
          />
        </div>

        {/* SIP User */}
        <div>
          <label className="block text-sm font-medium text-[#2F3941] mb-1.5">SIP Username</label>
          <input
            value={sipUser}
            onChange={(e) => setSipUser(e.target.value)}
            placeholder="e.g. 1001"
            className="w-full px-3 py-2 border border-[#D8DCDE] rounded-lg text-sm text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
          />
        </div>

        {/* SIP Password */}
        <div>
          <label className="block text-sm font-medium text-[#2F3941] mb-1.5">
            SIP Password {initialData && <span className="text-[#68717A] font-normal">(leave blank to keep current)</span>}
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={sipPass}
              onChange={(e) => setSipPass(e.target.value)}
              placeholder={initialData ? "••••••••" : "Enter SIP password"}
              className="w-full px-3 py-2 pr-10 border border-[#D8DCDE] rounded-lg text-sm text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68717A] hover:text-[#2F3941]"
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* WSS Host */}
        <div>
          <label className="block text-sm font-medium text-[#2F3941] mb-1.5">WSS Host (Yeastar WebSocket URL)</label>
          <input
            value={wssHost}
            onChange={(e) => setWssHost(e.target.value)}
            placeholder="e.g. wss://pbx.example.com:8089/ws"
            className="w-full px-3 py-2 border border-[#D8DCDE] rounded-lg text-sm text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] font-mono"
          />
          <p className="text-xs text-[#68717A] mt-1">The WebSocket URL from your Yeastar Cloud PBX</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#038153] hover:bg-[#026b44] disabled:opacity-60 text-white text-sm font-medium transition-colors"
        >
          <Save size={15} />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
