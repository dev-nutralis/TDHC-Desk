import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  // ── 5 Contacts ─────────────────────────────────────────────────────────────
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        user_id: user.id,
        field_values: {
          first_name: "Ana",
          last_name: "Kovač",
          mobile_numbers: [{ number: "+386 41 123 456", note: "Mobile" }],
          emails: [{ address: "ana.kovac@gmail.com", is_main: true }],
          created_at_override: "2026-01-15",
          gender: "female",
          portal_assignment: "option_1",
          course_assignment: "option_2",
          exams: "option_1",
          afp_client: true,
          source: { source: "facebook_messanger", groups: { esfvne7: "hot" } },
          blacklisted: false,
        },
      },
    }),
    prisma.contact.create({
      data: {
        user_id: user.id,
        field_values: {
          first_name: "Marko",
          last_name: "Novak",
          mobile_numbers: [{ number: "+386 40 234 567", note: "Mobile" }, { number: "+386 1 234 5678", note: "Office" }],
          emails: [{ address: "marko.novak@outlook.com", is_main: true }, { address: "m.novak@firma.si", is_main: false }],
          created_at_override: "2026-02-03",
          gender: "male",
          portal_assignment: "option_2",
          course_assignment: "option_1",
          exams: "option_2",
          afp_client: false,
          source: { source: "test", groups: { ed1twsw: "test" } },
          blacklisted: false,
        },
      },
    }),
    prisma.contact.create({
      data: {
        user_id: user.id,
        field_values: {
          first_name: "Petra",
          last_name: "Horvat",
          mobile_numbers: [{ number: "+386 51 345 678", note: "Mobile" }],
          emails: [{ address: "petra.horvat@yahoo.com", is_main: true }],
          created_at_override: "2026-02-20",
          gender: "female",
          portal_assignment: "option_1",
          course_assignment: "option_1",
          exams: "option_1",
          afp_client: true,
          source: { source: "facebook_messanger", groups: { esfvne7: "hot", xnfukke: "option_2" } },
          blacklisted: false,
        },
      },
    }),
    prisma.contact.create({
      data: {
        user_id: user.id,
        field_values: {
          first_name: "Luka",
          last_name: "Žagar",
          mobile_numbers: [{ number: "+386 64 456 789", note: "Mobile" }],
          emails: [{ address: "luka.zagar@gmail.com", is_main: true }],
          created_at_override: "2026-03-08",
          gender: "male",
          portal_assignment: "option_2",
          course_assignment: "option_2",
          exams: "option_2",
          afp_client: false,
          source: { source: "test3", groups: {} },
          blacklisted: false,
        },
      },
    }),
    prisma.contact.create({
      data: {
        user_id: user.id,
        field_values: {
          first_name: "Nina",
          last_name: "Kos",
          mobile_numbers: [{ number: "+386 70 567 890", note: "Mobile" }, { number: "+386 2 567 8901", note: "Home" }],
          emails: [{ address: "nina.kos@gmail.com", is_main: true }, { address: "nina@podjetje.si", is_main: false }],
          created_at_override: "2026-03-25",
          gender: "female",
          portal_assignment: "option_1",
          course_assignment: "option_2",
          exams: "option_1",
          afp_client: true,
          source: { source: "facebook_messanger", groups: { esfvne7: "hot", fb77q4m: "option_3" } },
          blacklisted: false,
        },
      },
    }),
  ]);

  console.log("✓ Created 5 contacts:", contacts.map(c => { const fv = c.field_values as Record<string, unknown> | null; return `${fv?.first_name} ${fv?.last_name}`; }).join(", "));

  // ── 5 Deals ────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        contact_id: contacts[0].id,
        user_id: user.id,
        field_values: {
          deal_name: "Ana Kovač — Prijava Tečaj",
          value: "1.200",
          pipeline: "prijava_na_tecaj",
          status_stg1: "",
          status_stg2: "",
          spol: "Ženski",
          note_1: "Stranka je zelo zainteresirana za tečaj prehrane. Kontaktirati v roku 3 dni.",
          termin_rezervacije_posveta_1: "2026-05-05T10:00:00.000Z",
          note_2: "Dogovorjen termin za uvodni pogovor.",
          d_datum_kreacije_dela: now,
          koda_za_popust: "SPRING20",
        },
      },
    }),
    prisma.deal.create({
      data: {
        contact_id: contacts[1].id,
        user_id: user.id,
        field_values: {
          deal_name: "Marko Novak — Brezplačna Predstavitev",
          value: "0",
          pipeline: "prijava_na_brezplacno_predstavitev",
          status_stg1: "",
          status_stg2: "",
          spol: "Moški",
          note_1: "Zanimanje za brezplačno predstavitev programa. Priti na lokacijo.",
          termin_rezervacije_posveta_1: "2026-05-10T14:30:00.000Z",
          note_2: "Potrebuje parkirišče — obvestiti receptorko.",
          d_datum_kreacije_dela: now,
          koda_za_popust: "",
        },
      },
    }),
    prisma.deal.create({
      data: {
        contact_id: contacts[2].id,
        user_id: user.id,
        field_values: {
          deal_name: "Petra Horvat — Odpoved Pogodbe",
          value: "850",
          pipeline: "odpoved_pogodbe",
          status_stg1: "",
          status_stg2: "",
          spol: "Ženski",
          note_1: "Stranka želi prekiniti pogodbo. Razlog: selitev v tujino.",
          termin_rezervacije_posveta_1: "2026-04-28T09:00:00.000Z",
          note_2: "Dogovorjen sestanek za reševanje odpovedi.",
          d_datum_kreacije_dela: now,
          koda_za_popust: "EXIT10",
        },
      },
    }),
    prisma.deal.create({
      data: {
        contact_id: contacts[3].id,
        user_id: user.id,
        field_values: {
          deal_name: "Luka Žagar — Prijava Tečaj Premium",
          value: "2.400",
          pipeline: "prijava_na_tecaj",
          status_stg1: "",
          status_stg2: "",
          spol: "Moški",
          note_1: "Premium paket — vključuje osebno vodenje 3 mesece.",
          termin_rezervacije_posveta_1: "2026-05-15T11:00:00.000Z",
          note_2: "Plačilo na obroke — dogovoriti se z računovodstvom.",
          d_datum_kreacije_dela: now,
          koda_za_popust: "PREMIUM15",
        },
      },
    }),
    prisma.deal.create({
      data: {
        contact_id: contacts[4].id,
        user_id: user.id,
        field_values: {
          deal_name: "Nina Kos — Brezplačna Predstavitev + Tečaj",
          value: "1.600",
          pipeline: "prijava_na_brezplacno_predstavitev",
          status_stg1: "",
          status_stg2: "",
          spol: "Ženski",
          note_1: "Najprej brezplačna predstavitev, nato odločitev glede tečaja.",
          termin_rezervacije_posveta_1: "2026-05-20T16:00:00.000Z",
          note_2: "Stranka ima dvojčka — upoštevati pri terminih.",
          d_datum_kreacije_dela: now,
          koda_za_popust: "MAMA10",
        },
      },
    }),
  ]);

  console.log("✓ Created 5 deals:", deals.map(d => (d.field_values as Record<string, unknown> | null)?.deal_name).join(", "));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
