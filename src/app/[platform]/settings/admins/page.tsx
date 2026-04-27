import AdminManager from "@/components/settings/AdminManager";

export default function AdminsSettingsPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#2F3941]">Admin Users</h1>
        <p className="text-sm text-[#68717A] mt-1">Manage admin accounts and platform access.</p>
      </div>
      <AdminManager />
    </div>
  );
}
