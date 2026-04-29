import KlaviyoFormsManager from "@/components/settings/KlaviyoFormsManager";

export default function KlaviyoSettingsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">Klaviyo Forms</h1>
        <p className="text-sm text-[#68717A] mt-1">
          Connect Klaviyo form submissions to automatically create contacts in this platform.
        </p>
      </div>
      <KlaviyoFormsManager />
    </div>
  );
}
