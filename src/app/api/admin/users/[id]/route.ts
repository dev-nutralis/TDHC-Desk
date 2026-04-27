import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import prisma from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: {
    first_name?: string
    last_name?: string
    email?: string
    role?: "admin" | "super_admin"
    platform_ids?: string[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { first_name, last_name, email, role, platform_ids } = body

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(first_name !== undefined && { first_name }),
          ...(last_name !== undefined && { last_name }),
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role }),
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
          created_at: true,
          platforms: {
            select: {
              platform_id: true,
              platform: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      })

      if (Array.isArray(platform_ids)) {
        await tx.userPlatform.deleteMany({ where: { user_id: id } })

        if (platform_ids.length > 0) {
          await tx.userPlatform.createMany({
            data: platform_ids.map((pid) => ({
              user_id: id,
              platform_id: pid,
            })),
          })
        }

        return tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            created_at: true,
            platforms: {
              select: {
                platform_id: true,
                platform: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        })
      }

      return updated
    })

    return NextResponse.json({ user })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  if (session.userId === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    throw err
  }
}
