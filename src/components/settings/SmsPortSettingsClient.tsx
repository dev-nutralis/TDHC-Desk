"use client";

import { useState } from "react";
import { Save, MessageSquare } from "lucide-react";

type Props = {
  platformId: string;
  initialGsmPort: string | null;
};

export function SmsPortSettingsClient({ platformId, initialGsmPort }: Props) {
  const [gsmPort, setGsmPort] = useState(initialGsmPort ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/platforms/${platformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gsm_port: gsmPort || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-[#EAF7F0] flex items-center justify-center">
          <MessageSquare size={17} className="text-[#038153]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#2F3941]">SMS Port</h2>
          <p className="text-xs text-[#68717A]">TG1600 GSM port koji se koristi za slanje i primanje SMS poruka</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EB] p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#2F3941] mb-1.5">GSM Port</label>
          <input
            type="number"
            min="1"
            max="32"
            value={gsmPort}
            onChange={e => setGsmPort(e.target.value)}
            placeholder="npr. 7"
            className="w-full px-3 py-2 border border-[#D8DCDE] rounded-lg text-sm text-[#2F3941] outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
          />
          <p className="text-xs text-[#68717A] mt-1">Broj porta na TG1600 uređaju (pogledaj Gateway → Mobile List)</p>
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
