import EmailsManager from "@/components/settings/EmailsManager";

export default function SettingsEmailsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#2F3941]">Emails</h2>
        <p className="text-sm text-[#68717A] mt-0.5">
          Manage email templates and tags used when composing emails to contacts.
        </p>
      </div>
      <EmailsManager />
    </div>
  );
}
