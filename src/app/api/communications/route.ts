import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformId } from "@/lib/platform";
import { sendEmail } from "@/lib/mailer";

// ---------------------------------------------------------------------------
// GET /api/communications
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
  const cookieStore = await cookies();
  const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
  const platformId = await getPlatformId(slug) ?? null;

  // Detect super admin
  const user = await prisma.user.findFirst();
  const isSuperAdmin = user?.role === "super_admin";

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit     = 50;
  const offset    = (page - 1) * limit;
  const search    = searchParams.get("search")?.trim() ?? "";
  const tab       = searchParams.get("tab") ?? "inbox";
  const threadId  = searchParams.get("thread_id") ?? null;
  const platformParam = searchParams.get("platform") ?? null; // "all" | platformId

  // Determine platform filter
  // Super admin with "all" or no filter → no platform_id restriction
  const resolvedPlatformId: string | null | undefined =
    isSuperAdmin && (platformParam === "all" || platformParam === null)
      ? undefined  // undefined = no filter in Prisma
      : platformParam && platformParam !== "all"
      ? platformParam
      : platformId;

  // Thread view: bypass tab filtering, return all messages in thread
  const tabWhere: Record<string, unknown> = threadId ? {} : (() => {
    switch (tab) {
      case "inbox":    return { direction: "inbound",  is_draft: false, is_spam: false, archived: false };
      case "sent":     return { direction: "outbound", is_draft: false, is_spam: false, archived: false };
      case "drafts":   return { is_draft: true };
      case "spam":     return { is_spam: true };
      case "archived": return { archived: true, is_spam: false };
      default:         return { direction: "inbound",  is_draft: false, is_spam: false, archived: false };
    }
  })();

  const where: Record<string, unknown> = {
    type: { in: ["email", "note"] },
    ...(resolvedPlatformId !== undefined ? { platform_id: resolvedPlatformId } : {}),
    ...(threadId ? { thread_id: threadId } : tabWhere),
    ...(search ? {
      OR: [
        { subject: { contains: search, mode: "insensitive" } },
        { contact: { field_values: { path: ["first_name"], string_contains: search } } },
        { contact: { field_values: { path: ["last_name"],  string_contains: search } } },
      ],
    } : {}),
  };

  const [activities, total] = await Promise.all([
    prisma.contactActivity.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
      include: {
        contact: { select: { id: true, field_values: true } },
        deal:    { select: { id: true, field_values: true } },
        ...(isSuperAdmin ? {
          // include platform info for badge
        } : {}),
      },
    }),
    prisma.contactActivity.count({ where }),
  ]);

  // Attach platform info for super admin
  let activitiesWithPlatform = activities as (typeof activities[0] & { platform?: { name: string; slug: string } | null })[];
  if (isSuperAdmin) {
    const platformIds = [...new Set(activities.map(a => a.platform_id).filter(Boolean))] as string[];
    const platforms = platformIds.length > 0
      ? await prisma.platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, name: true, slug: true } })
      : [];
    const platformMap = new Map(platforms.map(p => [p.id, p]));
    activitiesWithPlatform = activities.map(a => ({
      ...a,
      platform: a.platform_id ? (platformMap.get(a.platform_id) ?? null) : null,
    }));
  }

  // Platforms list for super admin filter dropdown
  let allPlatforms: { id: string; name: string; slug: string }[] = [];
  if (isSuperAdmin) {
    allPlatforms = await prisma.platform.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  }

  return NextResponse.json({
    activities: activitiesWithPlatform,
    total,
    page,
    pages: Math.ceil(total / limit),
    isSuperAdmin,
    allPlatforms,
  });
  } catch (err) {
    console.error("[GET /api/communications]", err);
    return NextResponse.json({
      activities: [],
      total: 0,
      page: 1,
      pages: 0,
      isSuperAdmin: false,
      allPlatforms: [],
      error: err instanceof Error ? err.message : "Internal server error",
    }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/communications — create draft or send email
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-platform-slug")?.value ?? "evalley";
    const platformId = await getPlatformId(slug) ?? null;

    const body = await req.json();
    const { contactId, subject, text, html, is_draft, thread_id } = body;

    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    if (!subject && !is_draft) return NextResponse.json({ error: "subject required" }, { status: 400 });
    if (!text && !html && !is_draft) return NextResponse.json({ error: "body required" }, { status: 400 });

    const contact = await prisma.contact.findFirst({ where: { id: contactId, platform_id: platformId } });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    if (!is_draft) {
      // Resolve platform SMTP config (platform-specific or fallback to env)
      const platform = platformId
        ? await prisma.platform.findUnique({ where: { id: platformId } })
        : null;

      if (!platform?.smtp_host || !platform?.smtp_user || !platform?.smtp_pass) {
        return NextResponse.json({ error: "Platform SMTP not configured" }, { status: 422 });
      }

      const smtp = {
        host:   platform.smtp_host,
        port:   Number(platform.smtp_port ?? 465),
        user:   platform.smtp_user,
        pass:   platform.smtp_pass,
        from:   platform.smtp_from ?? platform.smtp_user,
        secure: platform.smtp_secure ?? true,
      };

      const fv = contact.field_values as Record<string, unknown> | null;
      const emails = fv?.emails as { address: string; is_main: boolean }[] | undefined;
      const recipient = emails?.find(e => e.is_main)?.address ?? emails?.[0]?.address;
      if (!recipient) return NextResponse.json({ error: "Contact has no email address" }, { status: 422 });

      await sendEmail({
        to: recipient,
        subject: subject?.trim() || "(no subject)",
        text: text?.trim() ?? "",
        ...(html ? { html: html.trim() } : {}),
        smtp,
      });
    }

    const resolvedThreadId = thread_id ?? `${contactId}::${(subject ?? "").toLowerCase().replace(/^re:\s*/i, "").trim()}`;

    const activity = await prisma.contactActivity.create({
      data: {
        contact_id: contactId,
        type: "email",
        direction: "outbound",
        subject: subject?.trim() ?? null,
        body: html?.trim() || text?.trim() || "",
        platform_id: platformId,
        is_draft: is_draft ?? false,
        is_spam: false,
        is_read: true,
        thread_id: resolvedThreadId,
      },
      include: {
        contact: { select: { id: true, field_values: true } },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    console.error("[POST /api/communications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
