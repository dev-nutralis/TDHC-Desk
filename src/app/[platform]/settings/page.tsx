import { redirect } from "next/navigation";

export default async function PlatformSettingsPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  redirect(`/${platform}/settings/leads`);
}
