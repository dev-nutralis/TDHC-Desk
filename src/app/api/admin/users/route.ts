import { NextRequest, NextResponse } from "next/server"
import { getSession, hashPassword } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    orderBy: { created_at: "asc" },
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

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: {
    first_name?: string
    last_name?: string
    email?: string
    password?: string
    role?: "admin" | "super_admin"
    platform_ids?: string[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { first_name, last_name, email, password, role, platform_ids } = body

  if (!first_name || !last_name || !email || !password) {
    return NextResponse.json(
      { error: "first_name, last_name, email, and password are required" },
      { status: 400 }
    )
  }

  const password_hash = await hashPassword(password)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          first_name,
          last_name,
          email,
          password_hash,
          role: role ?? "admin",
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

      if (Array.isArray(platform_ids) && platform_ids.length > 0) {
        await tx.userPlatform.createMany({
          data: platform_ids.map((pid) => ({
            user_id: created.id,
            platform_id: pid,
          })),
        })

        return tx.user.findUnique({
          where: { id: created.id },
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

      return created
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (err: unknown) {
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
