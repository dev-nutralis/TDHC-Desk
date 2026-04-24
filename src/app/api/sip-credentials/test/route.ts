import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSipPassword } from "@/lib/sip-crypto";
import { getYeastarSignCredentials, isYeastarConfigured } from "@/lib/yeastar-client";

// GET /api/sip-credentials/test — debug endpoint, remove after testing
export async function GET() {
  const user = await prisma.user.findFirst();
  const account = user
    ? await prisma.sipAccount.findUnique({ where: { user_id: user.id } })
    : null;

  if (!account) {
    return NextResponse.json({ error: "No SIP account configured" });
  }

  let plain: string;
  let signResult: any = null;
  let signError: string | null = null;

  try {
    plain = decryptSipPassword(account.sip_pass);
  } catch (e) {
    return NextResponse.json({ error: "Failed to decrypt SIP password", detail: String(e) });
  }

  if (isYeastarConfigured()) {
    try {
      signResult = await getYeastarSignCredentials(account.sip_user);
    } catch (e) {
      signError = String(e);
    }
  }

  return NextResponse.json({
    extension: account.extension,
    sipUser: account.sip_user,
    wssHost: account.wss_host,
    plainPassLength: plain.length,
    yeastarConfigured: isYeastarConfigured(),
    signResult,
    signError,
  });
}
