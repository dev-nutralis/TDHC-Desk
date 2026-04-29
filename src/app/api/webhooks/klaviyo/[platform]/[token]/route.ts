import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Extracts the flat profile object from all known Klaviyo payload formats.
function extractProfile(body: unknown): Record<string, unknown> {
  const b = body as Record<string, unknown>;
  if (b?.data && (b.data as Record<string, unknown>)?.attributes) {
    return (b.data as Record<string, unknown>).attributes as Record<string, unknown>;
  }
  if (b?.profile) {
    return b.profile as Record<string, unknown>;
  }
  return b as Record<string, unknown>;
}

// Reads a single value from a profile using a klaviyo_field key.
// Supports top-level standard fields and "properties.xxx" custom properties.
function readProfileField(
  profile: Record<string, unknown>,
  klaviyoField: string
): string {
  if (klaviyoField.startsWith("properties.")) {
    const prop = klaviyoField.slice("properties.".length);
    const properties = profile.properties as Record<string, unknown> | undefined;
    return String(properties?.[prop] ?? "").trim();
  }
  return String(profile[klaviyoField] ?? "").trim();
}

const STANDARD_FALLBACK_FIELDS = ["email", "first_name", "last_name", "phone_number"] as const;

// POST /api/webhooks/klaviyo/[platform]/[token]
// Public endpoint — no authentication required. The token in the URL acts as the secret.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; token: string }> }
) {
  try {
    const { platform: platformSlug, token } = await params;

    // 1. Find the KlaviyoForm matching the token and platform slug
    const form = await prisma.klaviyoForm.findFirst({
      where: {
        token,
        platform: { slug: platformSlug },
      },
      include: { platform: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Parse Klaviyo payload and extract a flat profile
    const body = await req.json();
    console.log("[klaviyo webhook] raw body:", JSON.stringify(body));
    const profile = extractProfile(body);
    console.log("[klaviyo webhook] extracted profile:", JSON.stringify(profile));

    // 3. Resolve mappings
    const mappings = (
      form.mappings as { klaviyo_field: string; contact_field_key: string }[]
    ) ?? [];

    let fieldValues: Record<string, unknown> = {};

    // Email is always read directly from the Klaviyo profile — required for upsert
    const email = readProfileField(profile, "email");
    if (!email) {
      console.log("[klaviyo webhook] no email in profile:", JSON.stringify(profile));
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (mappings.length > 0) {
      // Use explicit mappings to build contact field_values
      for (const { klaviyo_field, contact_field_key } of mappings) {
        const value = readProfileField(profile, klaviyo_field);
        if (value) {
          fieldValues[contact_field_key] = value;
        }
      }
    } else {
      // Fallback: auto-detect standard fields so existing forms without mappings still work
      for (const key of STANDARD_FALLBACK_FIELDS) {
        const value = String(profile[key] ?? "").trim();
        if (value) {
          fieldValues[key === "phone_number" ? "phone" : key] = value;
        }
      }
    }

    const platform_id = form.platform_id;

    // 4. Find existing contact by email + platform_id
    const existing = await prisma.$queryRawUnsafe<{ id: string; field_values: unknown }[]>(
      `SELECT id, field_values FROM "Contact" WHERE field_values->>'email' = $1 AND platform_id = $2 LIMIT 1`,
      email,
      platform_id
    );

    if (existing.length > 0) {
      // 5a. Update — only overwrite fields that are provided (non-empty)
      const current = (existing[0].field_values ?? {}) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...current };

      for (const [key, value] of Object.entries(fieldValues)) {
        if (value) {
          updated[key] = value;
        }
      }

      await prisma.contact.update({
        where: { id: existing[0].id },
        data: { field_values: updated as Prisma.InputJsonValue },
      });
    } else {
      // 5b. Create new contact — user_id is required by schema, use the first available user
      const defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        return NextResponse.json({ error: "No users in system" }, { status: 500 });
      }

      await prisma.contact.create({
        data: {
          field_values: fieldValues as Prisma.InputJsonValue,
          platform_id,
          user_id: defaultUser.id,
        },
      });
    }

    // 6. Return success
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/klaviyo]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
