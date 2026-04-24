import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSipPassword, encryptSipPassword } from "@/lib/sip-crypto";
import { getYeastarSignCredentials, isYeastarConfigured } from "@/lib/yeastar-client";

// GET /api/sip-credentials — return SIP credentials for browser SDK
export async function GET() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ enabled: false });

    const account = await prisma.sipAccount.findUnique({ where: { user_id: user.id } });
    if (!account || !account.enabled) return NextResponse.json({ enabled: false });

    let sipPass: string;

    if (isYeastarConfigured()) {
      try {
        const plain = decryptSipPassword(account.sip_pass);
        const { sign } = await getYeastarSignCredentials(account.sip_user);
        sipPass = sign;
        void plain; // plain password used internally; sign returned to browser
      } catch (err) {
        console.error("[sip-credentials] Failed to get Yeastar sign:", err);
        // Fallback: return plain password (works with some Yeastar configs)
        sipPass = decryptSipPassword(account.sip_pass);
      }
    } else {
      // No Yeastar API configured — return plain password for direct SIP auth
      sipPass = decryptSipPassword(account.sip_pass);
    }

    return NextResponse.json({
      enabled: true,
      extension: account.extension,
      sipUser: account.sip_user,
      sipPass,
      wssHost: account.wss_host,
    });
  } catch (err) {
    console.error("[sip-credentials] GET error:", err);
    return NextResponse.json({ enabled: false });
  }
}

// POST /api/sip-credentials — create or update SIP account
export async function POST(req: NextRequest) {
  try {
    const { extension, sipUser, sipPass, wssHost, enabled } = await req.json();

    if (!extension || !sipUser || !sipPass || !wssHost) {
      return NextResponse.json({ error: "extension, sipUser, sipPass, wssHost are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "No user found" }, { status: 404 });

    const encryptedPass = encryptSipPassword(sipPass);

    const account = await prisma.sipAccount.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        extension,
        sip_user: sipUser,
        sip_pass: encryptedPass,
        wss_host: wssHost,
        enabled: enabled ?? true,
      },
      update: {
        extension,
        sip_user: sipUser,
        sip_pass: encryptedPass,
        wss_host: wssHost,
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json({ id: account.id, enabled: account.enabled }, { status: 200 });
  } catch (err) {
    console.error("[sip-credentials] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
