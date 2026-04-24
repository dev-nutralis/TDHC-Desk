import DealFieldsManager from "@/components/settings/DealFieldsManager";

export default function SettingsDealsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[#2F3941]">Deal Fields</h2>
          <p className="text-sm text-[#68717A] mt-0.5">Define the fields available on deal records.</p>
        </div>
        <DealFieldsManager />
      </div>
    </div>
  );
}
