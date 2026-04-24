import LeadFieldsManager from "@/components/settings/LeadFieldsManager";

export default function SettingsLeadsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[#2F3941]">Lead Fields</h2>
          <p className="text-sm text-[#68717A] mt-0.5">
            Define the fields available on lead records.
          </p>
        </div>
        <LeadFieldsManager />
      </div>
    </div>
  );
}
