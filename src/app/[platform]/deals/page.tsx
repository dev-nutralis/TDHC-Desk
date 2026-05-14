import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import DealsTable from "@/components/deals/DealsTable";

export default async function DealsPage() {
  const session = await getSession();
  const defaultUser = session?.userId
    ? await prisma.user.findUnique({ where: { id: session.userId } })
    : await prisma.user.findFirst();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 gap-4 shrink-0 shadow-sm">
        <span className="font-medium text-[#2F3941]">Deals</span>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <DealsTable defaultUserId={defaultUser?.id ?? ""} userRole={defaultUser?.role ?? "admin"} />
      </div>
    </div>
  );
}
