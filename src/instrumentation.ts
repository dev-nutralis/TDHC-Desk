export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startImapCron } = await import("./lib/imap-cron");
    startImapCron();
  }
}
