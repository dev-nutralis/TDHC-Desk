import { prisma } from "@/lib/prisma";
import { CallsClient } from "@/components/calls/CallsClient";

export default async function CallsPage() {
  const calls = await prisma.call.findMany({
    orderBy: { started_at: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CallsClient initialCalls={calls} />
    </div>
  );
}
