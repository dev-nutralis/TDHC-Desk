import { redirect } from "next/navigation";

export default async function PlatformHome({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  redirect(`/${platform}/leads`);
}
