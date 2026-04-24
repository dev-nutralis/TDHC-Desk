import ContactFieldsManager from "@/components/settings/ContactFieldsManager";

export default function ContactSettingsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">Contact Fields</h1>
        <p className="text-sm text-[#68717A] mt-1">Define and manage the fields that appear on contact records.</p>
      </div>
      <ContactFieldsManager />
    </div>
  );
}
