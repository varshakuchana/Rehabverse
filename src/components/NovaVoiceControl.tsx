"use client";
import type { InstructorMessage } from "@/lib/exerciseInstructor";
import { useNovaVoice } from "@/hooks/useNovaVoice";

/* Same behavior as before (preference, gating, cancellation); restyled as pills. */
export default function NovaVoiceControl({ message = null, allowed = false, compact = false }: { message?: InstructorMessage | null; allowed?: boolean; compact?: boolean }) {
  const voice = useNovaVoice(message, allowed);
  const pill = "min-h-9 rounded-full border px-3.5 text-[14px] font-semibold transition";
  return <div className={compact ? "text-[14px]" : "mt-3 text-[14px]"}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={voice.enabled} aria-label={`Nova voice ${voice.enabled ? "on" : "off"}`} onClick={voice.toggle}
        className={`${pill} ${voice.enabled ? "border-[#F2C14E] bg-[#F2C14E] text-[#2A2410]" : "border-white/40 hover:bg-white/10"}`}>
        Nova&apos;s voice {voice.enabled ? "on" : "off"}
      </button>
      {voice.busy ? <button type="button" onClick={voice.stop} className={`${pill} border-white/30 hover:bg-white/10`}>Stop</button>
        : voice.canSpeak && <button type="button" onClick={() => void voice.speak()} className={`${pill} border-white/30 hover:bg-white/10`}>Say it again</button>}
      {!compact && <span className="opacity-65">Saying &ldquo;Start&rdquo; works either way.</span>}
    </div>
    {!compact && voice.enabled && !allowed && <p className="mt-2 opacity-70">Nova stays quiet during setup and while waiting for Start.</p>}
    {voice.error && <p role="status" className="mt-2 text-[#FFD89A]">{voice.error}</p>}
  </div>;
}
