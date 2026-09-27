"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { InstructorMessage } from "@/lib/exerciseInstructor";
import { isSpeakableNovaText } from "@/lib/novaMessages";
import { beginNovaAudio } from "@/lib/novaAudioGate";
import { subscribeStorage } from "@/lib/demoStorage";
import { getNovaVoicePreference, setNovaVoicePreference } from "@/lib/novaVoicePreference";

const serverPreference = () => false;
export function useNovaVoice(message: InstructorMessage | null, allowed = false) {
  const enabled = useSyncExternalStore(subscribeStorage, getNovaVoicePreference, serverPreference);
  const [playback, setPlayback] = useState({ key: "", status: "idle", error: "" });
  const requestRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const releaseGateRef = useRef<(() => void) | null>(null);
  const handledRef = useRef("");
  const audioCacheRef = useRef(new Map<string, Blob>());
  const text = message?.text ?? "";
  const key = `${message?.id ?? ""}:${text}`;
  const canSpeak = enabled && allowed && isSpeakableNovaText(text);

  const cancelResources = useCallback(() => {
    requestRef.current?.abort(); requestRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute("src"); audio.load(); }
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    releaseGateRef.current?.(); releaseGateRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cancelResources();
    setPlayback({ key, status: "idle", error: "" });
  }, [cancelResources, key]);

  const speak = useCallback(async () => {
    if (!canSpeak) return;
    cancelResources();
    handledRef.current = key;
    const controller = new AbortController();
    requestRef.current = controller;
    setPlayback({ key, status: "loading", error: "" });
    try {
      let blob = audioCacheRef.current.get(text);
      if (!blob) {
        const response = await fetch("/api/voice", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }), signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(typeof data?.error === "string" ? data.error : "Nova voice is unavailable. Text guidance remains available.");
        }
        blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Nova voice returned no playable audio.");
        // Only allowlisted authored messages can enter this component-local cache.
        // Retrying playback can then call play() directly from a user click.
        audioCacheRef.current.set(text, blob);
      }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (controller.signal.aborted) return;
        cancelResources();
        setPlayback({ key, status: "idle", error: "" });
      };
      audio.onerror = () => {
        if (controller.signal.aborted) return;
        cancelResources();
        setPlayback({ key, status: "error", error: "Audio could not play. Use Speak message to retry; text guidance is still available." });
      };
      releaseGateRef.current = beginNovaAudio();
      await audio.play();
      if (!controller.signal.aborted) setPlayback({ key, status: "playing", error: "" });
    } catch (error) {
      if (controller.signal.aborted) return;
      cancelResources();
      const autoplayBlocked = error instanceof DOMException && error.name === "NotAllowedError";
      setPlayback({ key, status: "error", error: autoplayBlocked
        ? "Your browser paused audio. Use Speak message to retry."
        : error instanceof Error ? error.message : "Nova voice is unavailable. Text guidance remains available." });
    }
  }, [canSpeak, cancelResources, key, text]);

  useEffect(() => {
    if (!canSpeak) { handledRef.current = ""; cancelResources(); return; }
    // Debounce fleeting tracking changes. Stable text/id means rep/frame
    // rerenders cannot schedule another request. StrictMode cancels this timer.
    if (handledRef.current === key) return;
    const timer = window.setTimeout(() => { if (handledRef.current !== key) void speak(); }, 450);
    return () => { window.clearTimeout(timer); cancelResources(); };
  }, [canSpeak, key, speak, cancelResources]);
  useEffect(() => cancelResources, [cancelResources]);

  const toggle = useCallback(() => {
    if (enabled) stop();
    setNovaVoicePreference(!enabled);
  }, [enabled, stop]);
  return {
    enabled, toggle, speak, stop, canSpeak,
    busy: canSpeak && playback.key === key && (playback.status === "loading" || playback.status === "playing"),
    error: enabled && playback.key === key ? playback.error : "",
  };
}
