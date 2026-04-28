"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Contact2, Tag, Mail, User, Briefcase, CalendarDays, Phone, Building2, ShieldCheck } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const platform = (params?.platform as string) ?? "evalley";
  const { role } = useSession();
  const isSuperAdmin = role === "super_admin";

  const configTabs = [
    { href: `/${platform}/settings/leads`,    label: "Leads",    icon: Tag },
    { href: `/${platform}/settings/contacts`, label: "Contacts", icon: Contact2 },
    { href: `/${platform}/settings/deals`,    label: "Deals",    icon: Briefcase },
    { href: `/${platform}/settings/emails`,   label: "Emails",   icon: Mail },
    { href: `/${platform}/settings/sip`,      label: "SIP Phone", icon: Phone },
    { href: `/${platform}/settings/platforms`, label: "Platform", icon: Building2 },
    ...(isSuperAdmin ? [{ href: `/${platform}/settings/admins`, label: "Admins", icon: ShieldCheck }] : []),
  ];

  const preferencesTabs = [
    { href: `/${platform}/settings/profile`,      label: "Profile",     icon: User },
    { href: `/${platform}/settings/deal-profile`, label: "Deal Layout", icon: Briefcase },
    { href: `/${platform}/settings/calendar`,     label: "Calendar",    icon: CalendarDays },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 shrink-0 shadow-sm">
        <h1 className="font-semibold text-[#2F3941]">Settings</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 bg-white border-r border-[#D8DCDE] py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#68717A] px-3 mb-2">Configuration</p>
          {configTabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                style={active ? { background: "#EAF7F0", color: "#038153" } : { color: "#2F3941" }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                <Icon size={15} className="shrink-0" style={{ color: active ? "#038153" : "#68717A" }} />
                {label}
              </Link>
            );
          })}

          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#68717A] px-3 mb-2">Preferences</p>
            {preferencesTabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  style={active ? { background: "#EAF7F0", color: "#038153" } : { color: "#2F3941" }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <Icon size={15} className="shrink-0" style={{ color: active ? "#038153" : "#68717A" }} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 overflow-auto p-6 bg-[#F3F4F6]">
          {children}
        </div>
      </div>
    </div>
  );
}
