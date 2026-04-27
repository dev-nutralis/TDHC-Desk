import { prisma } from "@/lib/prisma";
import TasksClient from "@/components/tasks/TasksClient";

export default async function TasksPage() {
  const user = await prisma.user.findFirst();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TasksClient defaultUserId={user?.id ?? ""} />
    </div>
  );
}
