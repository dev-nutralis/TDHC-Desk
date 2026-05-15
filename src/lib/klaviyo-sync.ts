import { prisma } from "@/lib/prisma";

const KLAVIYO_API_BASE = "https://a.klaviyo.com/api";

// Reads the first email address from a contact's multi_email field
function extractEmail(fieldValues: Record<string, unknown>): string | null {
  for (const val of Object.values(fieldValues)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null && "address" in val[0]) {
      const addr = (val[0] as { address: string }).address;
      return addr?.trim() || null;
    }
  }
  return null;
}

// Reads the pipeline value from contact field_values
function extractPipeline(fieldValues: Record<string, unknown>): string | null {
  const val = fieldValues["pipeline"];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

// Upsert a Klaviyo profile by email, returns profile ID
async function upsertKlaviyoProfile(
  apiKey: string,
  email: string,
  firstName?: string,
  lastName?: string,
  phone?: string
): Promise<string | null> {
  const res = await fetch(`${KLAVIYO_API_BASE}/profiles/`, {
    method: "POST",
    headers: {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      "revision": "2024-02-15",
    },
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes: {
          email,
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          ...(phone ? { phone_number: phone } : {}),
        },
      },
    }),
  });

  if (res.status === 409) {
    // Profile already exists — extract ID from conflict response
    const json = await res.json();
    return json?.errors?.[0]?.meta?.duplicate_profile_id ?? null;
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[klaviyo-sync] upsert profile failed:", res.status, text);
    return null;
  }

  const json = await res.json();
  return json?.data?.id ?? null;
}

// Add profile to a Klaviyo list
async function addToList(apiKey: string, listId: string, profileId: string): Promise<void> {
  const res = await fetch(`${KLAVIYO_API_BASE}/lists/${listId}/relationships/profiles/`, {
    method: "POST",
    headers: {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      "revision": "2024-02-15",
    },
    body: JSON.stringify({ data: [{ type: "profile", id: profileId }] }),
  });
  if (!res.ok && res.status !== 409) {
    console.error("[klaviyo-sync] add to list failed:", listId, res.status, await res.text());
  }
}

// Remove profile from a Klaviyo list
async function removeFromList(apiKey: string, listId: string, profileId: string): Promise<void> {
  const res = await fetch(`${KLAVIYO_API_BASE}/lists/${listId}/relationships/profiles/`, {
    method: "DELETE",
    headers: {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      "revision": "2024-02-15",
    },
    body: JSON.stringify({ data: [{ type: "profile", id: profileId }] }),
  });
  if (!res.ok && res.status !== 404) {
    console.error("[klaviyo-sync] remove from list failed:", listId, res.status, await res.text());
  }
}

// Main sync function — call this whenever a contact is created or updated
export async function syncContactToKlaviyo(contactId: string): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        field_values: true,
        klaviyo_profile_id: true,
        platform_id: true,
      },
    });

    if (!contact?.platform_id) return;

    const fv = (contact.field_values ?? {}) as Record<string, unknown>;
    const email = extractEmail(fv);
    if (!email) return; // No email — skip

    const platform = await prisma.platform.findUnique({
      where: { id: contact.platform_id },
      select: { klaviyo_api_key: true, klaviyo_pipeline_lists: true },
    });

    const apiKey = platform?.klaviyo_api_key?.trim();
    if (!apiKey) return; // No API key configured

    const pipelineLists = ((platform?.klaviyo_pipeline_lists ?? {}) as Record<string, string>);
    const pipeline = extractPipeline(fv);

    // Extract name and phone for profile enrichment
    const firstName = typeof fv["first_name"] === "string" ? fv["first_name"] : undefined;
    const lastName = typeof fv["last_name"] === "string" ? fv["last_name"] : undefined;
    let phone: string | undefined;
    for (const val of Object.values(fv)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null && "number" in val[0]) {
        phone = (val[0] as { number: string }).number?.trim() || undefined;
        break;
      }
    }

    // 1. Upsert profile in Klaviyo
    const profileId = await upsertKlaviyoProfile(apiKey, email, firstName, lastName, phone);
    if (!profileId) return;

    // 2. Remove from all pipeline lists (clean slate)
    const allListIds = Object.values(pipelineLists).filter(Boolean);
    await Promise.all(allListIds.map(listId => removeFromList(apiKey, listId, profileId)));

    // 3. Add to the correct pipeline list
    if (pipeline && pipelineLists[pipeline]) {
      await addToList(apiKey, pipelineLists[pipeline], profileId);
    }

    // 4. Update contact with profile ID and sync timestamp
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        klaviyo_profile_id: profileId,
        klaviyo_synced_at: new Date(),
      },
    });

    console.log(`[klaviyo-sync] synced contact ${contactId} → profile ${profileId}, list: ${pipeline ?? "none"}`);
  } catch (err) {
    console.error("[klaviyo-sync] error syncing contact", contactId, err);
  }
}
