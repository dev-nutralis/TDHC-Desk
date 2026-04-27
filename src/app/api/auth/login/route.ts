import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth"

// Rate-limiting state: keyed by IP
interface RateLimitEntry {
  count: number
  resetAt: number
}

const failedAttempts = new Map<string, RateLimitEntry>()

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for") ?? "unknown"
}

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip)
  if (!entry) return false
  if (Date.now() > entry.resetAt) {
    failedAttempts.delete(ip)
    return false
  }
  return entry.count >= RATE_LIMIT_MAX
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const entry = failedAttempts.get(ip)

  if (!entry || now > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count += 1
  }
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip)
}

export async function POST(request: NextRequest) {
  const ip = getIp(request)

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      platforms: {
        include: { platform: true },
      },
    },
  })

  if (!user || !user.password_hash) {
    recordFailure(ip)
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    )
  }

  const passwordValid = await verifyPassword(password, user.password_hash)

  if (!passwordValid) {
    recordFailure(ip)
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    )
  }

  // Successful login — clear rate-limit counter
  clearFailures(ip)

  // Store slugs (not IDs) so middleware can compare against URL slug directly
  const platformIds = user.platforms.map((up) => up.platform.slug)

  const payload = {
    userId: user.id,
    role: user.role as "super_admin" | "admin",
    platformIds,
  }

  await setSessionCookie(payload)

  // Determine where to send the user after login
  let redirectTo = "/login"
  if (user.role === "super_admin") {
    const firstPlatform = await prisma.platform.findFirst({ orderBy: { created_at: "asc" } })
    redirectTo = firstPlatform ? `/${firstPlatform.slug}/leads` : "/login"
  } else {
    const firstPlatform = user.platforms[0]?.platform
    redirectTo = firstPlatform ? `/${firstPlatform.slug}/leads` : "/login"
  }

  return NextResponse.json({ ok: true, redirectTo }, { status: 200 })
}
