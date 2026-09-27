"use client";
import type { InstructorMessage } from "@/lib/exerciseInstructor";
import { useNovaVoice } from "@/hooks/useNovaVoice";

export default function NovaVoiceControl({ message = null, allowed = false }: { message?: InstructorMessage | null; allowed?: boolean }) {
  const voice = useNovaVoice(message, allowed);
  return <div className="mt-3 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={voice.enabled} aria-label={`Nova voice ${voice.enabled ? "on" : "off"}`} onClick={voice.toggle} className="rounded-lg border border-cyan-200/25 px-3 py-2 text-cyan-100 hover:bg-cyan-200/10 focus-visible:outline-2 focus-visible:outline-cyan-200">Voice {voice.enabled ? "On" : "Off"}</button>
      {voice.busy ? <button type="button" onClick={voice.stop} className="rounded-lg border border-white/20 px-3 py-2 text-slate-200">Stop speech</button> : voice.canSpeak && <button type="button" onClick={() => void voice.speak()} className="rounded-lg border border-white/20 px-3 py-2 text-slate-200">Speak message</button>}
      <span className="text-slate-400">Nova narration · Start voice input stays separate</span>
    </div>
    {voice.enabled && !allowed && <p className="mt-2 text-slate-400">Nova stays quiet during setup and while waiting for Start.</p>}
    {voice.error && <p role="status" className="mt-2 text-amber-100">{voice.error}</p>}
  </div>;
}
