import PlatformSettingsManager from "@/components/settings/PlatformSettingsManager";

export default function PlatformSettingsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">Platforms</h1>
        <p className="text-sm text-[#68717A] mt-1">Manage platforms (tenants) for this CRM.</p>
      </div>
      <PlatformSettingsManager />
    </div>
  );
}
