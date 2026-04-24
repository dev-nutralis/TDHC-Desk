import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/webhooks/active-campaign
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.AC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const first_name = body.first_name || body["contact[first_name]"] || "";
  const last_name  = body.last_name  || body["contact[last_name]"]  || "";

  if (!first_name && !last_name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const defaultUser = await prisma.user.findFirst();
  if (!defaultUser) {
    return NextResponse.json({ error: "No users in system" }, { status: 500 });
  }

  const lead = await prisma.lead.create({
    data: { field_values: { first_name, last_name }, user_id: defaultUser.id },
  });

  return NextResponse.json({ message: "Lead created", lead }, { status: 201 });
}
