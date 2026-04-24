import { prisma } from "@/lib/prisma";
import CalendarClient from "@/components/calendar/CalendarClient";

export default async function CalendarPage() {
  const user = await prisma.user.findFirst();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CalendarClient defaultUserId={user?.id ?? ""} />
    </div>
  );
}
