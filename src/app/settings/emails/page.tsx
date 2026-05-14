import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import EmailsManager from "@/components/settings/EmailsManager";
import EmailConfigSettingsClient from "@/components/settings/EmailConfigSettingsClient";

export default async function SettingsEmailsPage() {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  const platform = platformId ? await prisma.platform.findUnique({
    where: { id: platformId },
    select: {
      id: true,
      smtp_host: true, smtp_port: true, smtp_user: true, smtp_pass: true, smtp_from: true, smtp_secure: true,
      imap_host: true, imap_port: true, imap_user: true, imap_pass: true, imap_enabled: true,
      email_auto_contact_source_id: true,
      email_auto_contact_attribute_ids: true,
    },
  }) : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#2F3941]">Emails</h2>
        <p className="text-sm text-[#68717A] mt-0.5">
          Manage SMTP/IMAP, templates, tags, and how unknown senders are handled.
        </p>
      </div>

      {platform && (
        <EmailConfigSettingsClient
          platformId={platform.id}
          initialConfig={{
            smtp_host:    platform.smtp_host    ?? "",
            smtp_port:    String(platform.smtp_port ?? ""),
            smtp_user:    platform.smtp_user    ?? "",
            smtp_pass:    platform.smtp_pass    ?? "",
            smtp_from:    platform.smtp_from    ?? "",
            smtp_secure:  platform.smtp_secure,
            imap_host:    platform.imap_host    ?? "",
            imap_port:    String(platform.imap_port ?? ""),
            imap_user:    platform.imap_user    ?? "",
            imap_pass:    platform.imap_pass    ?? "",
            imap_enabled: platform.imap_enabled,
            email_auto_contact_source_id: platform.email_auto_contact_source_id ?? "",
            email_auto_contact_attribute_ids: platform.email_auto_contact_attribute_ids ?? "",
          }}
        />
      )}

      <EmailsManager />
    </div>
  );
}
