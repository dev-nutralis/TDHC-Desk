"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  Users, Briefcase, Settings,
  Contact2, Phone, ChevronLeft, ChevronRight, CalendarDays, Inbox, CheckSquare,
  ChevronDown, Check, Building2, LogOut, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/leads",          label: "Leads",          icon: Users },
      { href: "/contacts",       label: "Contacts",       icon: Contact2 },
      { href: "/deals",          label: "Deals",          icon: Briefcase },
      { href: "/calendar",       label: "Calendar",       icon: CalendarDays },
      { href: "/tasks",          label: "Tasks",          icon: CheckSquare },
      { href: "/calls",          label: "Calls",          icon: Phone },
      { href: "/communications", label: "Communications", icon: Inbox },
      { href: "/email",          label: "Email",          icon: Mail },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface Platform {
  id: string;
  name: string;
  slug: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const platform = (params?.platform as string) ?? "evalley";

  const [collapsed, setCollapsed] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{ role: string | null; platformIds: string[] }>({ role: null, platformIds: [] });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar_collapsed");
      if (stored !== null) setCollapsed(stored === "true");
    } catch { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => setSession({ role: data.role ?? null, platformIds: data.platformIds ?? [] }));
  }, []);

  useEffect(() => {
    fetch("/api/platforms")
      .then(r => r.json())
      .then(data => setPlatforms(data.platforms ?? []));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function toggle() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* */ }
      return next;
    });
  }

  function switchPlatform(slug: string) {
    setDropdownOpen(false);
    router.push(`/${slug}/leads`);
  }

  const isSuperAdmin = session.role === "super_admin";
  const visiblePlatforms = isSuperAdmin
    ? platforms
    : platforms.filter(p => session.platformIds.includes(p.slug));
  const canSwitch = visiblePlatforms.length > 1;

  const currentPlatform = platforms.find(p => p.slug === platform) ?? null;
  const displayName = currentPlatform?.name ?? platform;

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col h-screen sticky top-0 transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
      style={{ background: "var(--zd-sidebar)" }}
    >
      {/* Platform switcher */}
      <div
        ref={dropdownRef}
        className="relative shrink-0"
        style={{ borderBottom: "1px solid var(--zd-sidebar-border)" }}
      >
        <button
          onClick={() => canSwitch && setDropdownOpen(prev => !prev)}
          className={cn(
            "w-full h-14 flex items-center transition-colors",
            canSwitch && "hover:bg-white/5",
            collapsed ? "justify-center px-0" : "px-4 gap-2"
          )}
          style={{ cursor: canSwitch ? "pointer" : "default" }}
        >
          {collapsed ? (
            <span className="text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <>
              <span className="text-white text-[15px] font-bold leading-tight truncate flex-1 text-left">
                {displayName}
              </span>
              {canSwitch && (
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  className={cn("shrink-0 text-white/50 transition-transform", dropdownOpen && "rotate-180")}
                />
              )}
            </>
          )}
        </button>

        {/* Dropdown */}
        {dropdownOpen && canSwitch && !collapsed && (
          <div
            className="absolute top-full left-0 right-0 z-50 py-1 rounded-b-lg overflow-hidden"
            style={{ background: "var(--zd-sidebar)", borderTop: "1px solid var(--zd-sidebar-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
          >
            {visiblePlatforms.map(p => (
              <button
                key={p.id}
                onClick={() => switchPlatform(p.slug)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 transition-colors text-left"
              >
                <span
                  className="flex-1 text-sm font-medium truncate"
                  style={{ color: p.slug === platform ? "white" : "var(--zd-sidebar-text)" }}
                >
                  {p.name}
                </span>
                {p.slug === platform && (
                  <Check size={13} className="shrink-0 text-[#038153]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <p
                className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const fullHref = `/${platform}${href}`;
                const active =
                  pathname === fullHref || pathname.startsWith(fullHref + "/");
                return (
                  <Link
                    key={href}
                    href={fullHref}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center py-2 rounded-md text-[13px] font-medium transition-all duration-150 relative",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active ? "text-white" : "hover:text-white"
                    )}
                    style={{
                      color: active ? "var(--zd-sidebar-text-active)" : "var(--zd-sidebar-text)",
                      background: active ? "var(--zd-sidebar-active)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = "var(--zd-sidebar-hover)";
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                    {!collapsed && label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse/expand toggle */}
      <div className="px-3">
        <button
          onClick={toggle}
          className="w-full py-2 flex items-center justify-center text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={1.8} /> : <ChevronLeft size={16} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Bottom user area */}
      <div className="p-3" style={{ borderTop: "1px solid var(--zd-sidebar-border)" }}>
        <div
          className={cn(
            "flex items-center py-1.5 rounded-md",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2"
          )}
          style={{ color: "var(--zd-sidebar-text)" }}
        >
          <div className="w-7 h-7 rounded-full bg-[#2A4E5C] border border-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">A</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white truncate">Admin</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white transition-colors"
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
