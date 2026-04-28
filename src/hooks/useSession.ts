"use client";

import { useState, useEffect } from "react";

interface SessionInfo {
  role: "super_admin" | "admin" | null;
  userId: string | null;
}

export function useSession(): SessionInfo {
  const [session, setSession] = useState<SessionInfo>({ role: null, userId: null });

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => setSession({ role: data.role ?? null, userId: data.userId ?? null }))
      .catch(() => {});
  }, []);

  return session;
}
