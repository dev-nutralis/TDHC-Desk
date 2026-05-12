"use client";

import { useCallback, useEffect, useState } from "react";

export type SourceModuleKey = "lead" | "contact" | "deal";

interface SourceItem { id: string; label: string; sort_order: number; }
interface SourceGroup { id: string; name: string; sort_order: number; items: SourceItem[]; }
export interface Source { id: string; name: string; attribute_groups: SourceGroup[]; }

const SHOW_FIELDS: Record<SourceModuleKey, "lead_show_source" | "contact_show_source" | "deal_show_source"> = {
  lead:    "lead_show_source",
  contact: "contact_show_source",
  deal:    "deal_show_source",
};

const ORDER_FIELDS: Record<SourceModuleKey, "lead_source_sort_order" | "contact_source_sort_order" | "deal_source_sort_order"> = {
  lead:    "lead_source_sort_order",
  contact: "contact_source_sort_order",
  deal:    "deal_source_sort_order",
};

const EVENT_NAME = "source-field-changed";

export function useSourceField(module: SourceModuleKey) {
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [enabled, setEnabled]       = useState<boolean | null>(null);
  const [sortOrder, setSortOrder]   = useState<number>(0);
  const [sources, setSources]       = useState<Source[]>([]);
  const [loading, setLoading]       = useState(true);

  const reload = useCallback(async () => {
    try {
      const [platformRes, sourcesRes] = await Promise.all([
        fetch("/api/platforms/current"),
        fetch("/api/sources"),
      ]);
      const platform = platformRes.ok ? await platformRes.json() : null;
      const sourcesData = sourcesRes.ok ? await sourcesRes.json() : [];
      setPlatformId(platform?.id ?? null);
      setEnabled(Boolean(platform?.[SHOW_FIELDS[module]] ?? false));
      setSortOrder(Number(platform?.[ORDER_FIELDS[module]] ?? 0));
      setSources(sourcesData);
    } catch {
      setEnabled(false);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh on any global toggle change
  useEffect(() => {
    const h = () => reload();
    window.addEventListener(EVENT_NAME, h);
    return () => window.removeEventListener(EVENT_NAME, h);
  }, [reload]);

  const updateEnabled = useCallback(async (next: boolean) => {
    if (!platformId) return;
    setEnabled(next);
    try {
      await fetch(`/api/platforms/${platformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [SHOW_FIELDS[module]]: next }),
      });
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      setEnabled(!next);
    }
  }, [platformId, module]);

  const updateSortOrder = useCallback(async (next: number) => {
    if (!platformId) return;
    setSortOrder(next);
    try {
      await fetch(`/api/platforms/${platformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [ORDER_FIELDS[module]]: next }),
      });
    } catch { /* ignore — state already updated optimistically */ }
  }, [platformId, module]);

  return {
    loading,
    enabled: enabled ?? false,
    sortOrder,
    sources,
    updateEnabled,
    updateSortOrder,
  };
}
