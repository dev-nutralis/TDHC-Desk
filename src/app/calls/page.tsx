import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { CallsClient } from "@/components/calls/CallsClient";

export default async function CallsPage() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const calls = await prisma.call.findMany({
    where: { platform_id: platformId },
    orderBy: { started_at: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CallsClient initialCalls={calls} />
    </div>
  );
}
