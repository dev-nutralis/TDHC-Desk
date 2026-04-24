"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact2, Tag, Mail, User, Briefcase, CalendarDays, Phone } from "lucide-react";

const configTabs = [
  { href: "/settings/leads",    label: "Leads",    icon: Tag },
  { href: "/settings/contacts", label: "Contacts", icon: Contact2 },
  { href: "/settings/deals",    label: "Deals",    icon: Briefcase },
  { href: "/settings/emails",   label: "Emails",   icon: Mail },
  { href: "/settings/sip",      label: "SIP Phone", icon: Phone },
];

const preferencesTabs = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/deal-profile", label: "Deal Layout", icon: Briefcase },
  { href: "/settings/calendar", label: "Calendar", icon: CalendarDays },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
      style={active ? {
        background: "#EAF7F0",
        color: "#038153",
      } : {
        color: "#2F3941",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      <Icon size={15} className="shrink-0" style={{ color: active ? "#038153" : "#68717A" }} />
      {label}
    </Link>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#D8DCDE] flex items-center px-6 shrink-0 shadow-sm">
        <h1 className="font-semibold text-[#2F3941]">Settings</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 bg-white border-r border-[#D8DCDE] py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#68717A] px-3 mb-2">Configuration</p>
          {configTabs.map(t => (
            <NavLink key={t.href} {...t} />
          ))}

          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#68717A] px-3 mb-2">Preferences</p>
            {preferencesTabs.map(t => (
              <NavLink key={t.href} {...t} />
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-auto p-6 bg-[#F3F4F6]">
          {children}
        </div>
      </div>
    </div>
  );
}
