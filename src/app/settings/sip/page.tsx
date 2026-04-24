import { prisma } from "@/lib/prisma";
import { SipSettingsClient } from "@/components/settings/SipSettingsClient";

export default async function SipSettingsPage() {
  const user = await prisma.user.findFirst();
  const account = user
    ? await prisma.sipAccount.findUnique({ where: { user_id: user.id } })
    : null;

  return (
    <SipSettingsClient
      initialData={account ? {
        extension: account.extension,
        sipUser: account.sip_user,
        wssHost: account.wss_host,
        enabled: account.enabled,
      } : null}
    />
  );
}
