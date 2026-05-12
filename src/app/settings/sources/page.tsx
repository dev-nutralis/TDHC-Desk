import SourcesManager from "@/components/settings/SourcesManager";

export default function SettingsSourcesPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#2F3941]">Sources</h2>
        <p className="text-sm text-[#68717A] mt-0.5">
          Sources are shared across leads, contacts, and deals — used to track where records came from.
        </p>
      </div>
      <SourcesManager />
    </div>
  );
}
