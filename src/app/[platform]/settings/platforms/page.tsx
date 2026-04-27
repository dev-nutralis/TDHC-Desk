import CurrentPlatformSettings from "@/components/settings/CurrentPlatformSettings";

export default function PlatformSettingsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">Platform Settings</h1>
        <p className="text-sm text-[#68717A] mt-1">Configure the name, branding, and transcription settings for this platform.</p>
      </div>
      <CurrentPlatformSettings />
    </div>
  );
}
