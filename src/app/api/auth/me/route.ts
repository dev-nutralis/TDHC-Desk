import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ role: null, userId: null, platformIds: [] });
  return NextResponse.json({ role: session.role, userId: session.userId, platformIds: session.platformIds });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { first_name, last_name, email, current_password, new_password } = body;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If changing password, verify current password first
  if (new_password) {
    if (!current_password) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const valid = await verifyPassword(current_password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
  }

  // Check email uniqueness if changing
  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(first_name ? { first_name } : {}),
      ...(last_name ? { last_name } : {}),
      ...(email ? { email } : {}),
      ...(new_password ? { password_hash: await hashPassword(new_password) } : {}),
    },
  });

  return NextResponse.json({ ok: true, first_name: updated.first_name, last_name: updated.last_name, email: updated.email });
}
