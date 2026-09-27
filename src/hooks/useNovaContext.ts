"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { NovaContext } from "@/lib/novaAssistant";
export function useNovaContext(context: Omit<NovaContext, "route">, reset: () => void, startSession?: () => void) {
  const route = usePathname();
  const resetRef = useRef(reset);
  const startSessionRef = useRef(startSession);
  useEffect(() => { resetRef.current = reset; startSessionRef.current = startSession; });
  const serialized = JSON.stringify({ ...context, route, mode: route.startsWith("/story") ? "Story" : context.mode });
  useEffect(() => {
    const publish = () => window.dispatchEvent(new CustomEvent("nova-context", { detail: JSON.parse(serialized) }));
    publish();
    const restart = () => resetRef.current();
    const start = () => startSessionRef.current?.();
    window.addEventListener("nova-context-request", publish);
    window.addEventListener("nova-reset", restart);
    window.addEventListener("nova-session-start", start);
    return () => { window.removeEventListener("nova-context-request", publish); window.removeEventListener("nova-reset", restart); window.removeEventListener("nova-session-start", start); window.dispatchEvent(new CustomEvent("nova-context", { detail: null })); };
  }, [serialized]);
}
