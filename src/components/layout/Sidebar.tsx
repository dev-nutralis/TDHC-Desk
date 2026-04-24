"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, Briefcase, BarChart2, Settings,
  Contact2, Phone, Zap, ChevronLeft, ChevronRight, CalendarDays, Inbox, CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/contacts", label: "Contacts", icon: Contact2 },
      { href: "/deals", label: "Deals", icon: Briefcase },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/tasks",    label: "Tasks",    icon: CheckSquare },
      { href: "/calls",    label: "Calls",    icon: Phone },
      { href: "/communications", label: "Communications", icon: Inbox },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar_collapsed");
      if (stored !== null) {
        setCollapsed(stored === "true");
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function toggle() {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col h-screen sticky top-0 transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
      style={{ background: "var(--zd-sidebar)" }}
    >
      {/* Logo / App name */}
      <div
        className={cn(
          "h-14 flex items-center shrink-0",
          collapsed ? "justify-center px-0" : "px-5 gap-2.5"
        )}
        style={{ borderBottom: "1px solid var(--zd-sidebar-border)" }}
      >
        <div className="w-7 h-7 rounded-md bg-[#038153] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">T</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-white text-sm font-semibold leading-tight">TDHC Desk</span>
            <span className="text-[10px]" style={{ color: "var(--zd-sidebar-text)" }}>Sales CRM</span>
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
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
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
            "flex items-center py-1.5 rounded-md cursor-pointer",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2"
          )}
          style={{ color: "var(--zd-sidebar-text)" }}
        >
          <div className="w-7 h-7 rounded-full bg-[#2A4E5C] border border-white/20 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">A</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white truncate">Admin</p>
              <p className="text-[10px] truncate" style={{ color: "var(--zd-sidebar-text)" }}>admin@tdhc.com</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
