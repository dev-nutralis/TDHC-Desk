import { prisma } from "./prisma";
import { syncInbox } from "./imap-sync";

let started = false;

export function startImapCron() {
  if (started) return;
  started = true;

  console.log("[imap-cron] started — interval 30s");

  setInterval(async () => {
    try {
      const platforms = await prisma.platform.findMany({
        where: { imap_enabled: true },
        select: { id: true, slug: true },
      });

      await Promise.all(
        platforms.map(async (p) => {
          try {
            const result = await syncInbox(p.id);
            if (result.synced > 0) {
              console.log(`[imap-cron] ${p.slug}: synced ${result.synced}`);
            }
          } catch (err) {
            console.error(`[imap-cron] ${p.slug} error:`, err);
          }
        })
      );
    } catch (err) {
      console.error("[imap-cron] fatal error:", err);
    }
  }, 30_000);
}
