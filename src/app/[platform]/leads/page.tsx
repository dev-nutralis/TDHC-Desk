import { prisma } from "@/lib/prisma";
import LeadsTable from "@/components/leads/LeadsTable";

export default async function LeadsPage() {
  const defaultUser = await prisma.user.findFirst();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar — Zendesk style */}
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-[#68717A]">
          <span className="font-medium text-[#2F3941]">Leads</span>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-auto p-6">
        <LeadsTable defaultUserId={defaultUser?.id ?? ""} />
      </div>
    </div>
  );
}
