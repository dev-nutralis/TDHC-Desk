import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { SipSettingsClient } from "@/components/settings/SipSettingsClient";
import { SmsPortSettingsClient } from "@/components/settings/SmsPortSettingsClient";

export default async function SipSettingsPage() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const [user, platform] = await Promise.all([
    prisma.user.findFirst(),
    platformId ? prisma.platform.findUnique({
      where: { id: platformId },
      select: { id: true, gsm_port: true },
    }) : null,
  ]);

  const account = user
    ? await prisma.sipAccount.findUnique({ where: { user_id: user.id } })
    : null;

  return (
    <>
      <SipSettingsClient
        initialData={account ? {
          extension: account.extension,
          sipUser: account.sip_user,
          wssHost: account.wss_host,
          enabled: account.enabled,
        } : null}
      />
      {platform && (
        <SmsPortSettingsClient
          platformId={platform.id}
          initialGsmPort={platform.gsm_port}
        />
      )}
    </>
  );
}
