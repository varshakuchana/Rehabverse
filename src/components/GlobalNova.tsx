"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NovaMark } from "./NovaMark";
import { deterministicNova, safeNovaContext, type NovaContext } from "@/lib/novaAssistant";
import { finalSpeechQuestion, shouldAutoSpeakNova, shouldSubmitNovaKey } from "@/lib/novaInteraction";
import { useConfirmedPlan, useProgress } from "@/hooks/useProgress";
import { subscribeStorage } from "@/lib/demoStorage";
import { getNovaVoicePreference, setNovaVoicePreference } from "@/lib/novaVoicePreference";
import { beginNovaAudio, setNovaPanelOpen } from "@/lib/novaAudioGate";
import { frequencyInfo } from "@/lib/scheduleStorage";

type Message = { role: "user" | "assistant"; text: string; voiceToken?: string };
export default function GlobalNova() {
  const route = usePathname();
  return <NovaPanel key={route} route={route} />;
}

function NovaPanel({ route }: { route: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [session, setSession] = useState<NovaContext | null>(null);
  const chatRequest = useRef<AbortController | null>(null);
  const voiceRequest = useRef<AbortController | null>(null);
  const speech = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioURL = useRef<string | null>(null);
  const release = useRef<(() => void) | null>(null);
  const plan = useConfirmedPlan();
  const progress = useProgress();
  const voice = useSyncExternalStore(subscribeStorage, getNovaVoicePreference, () => false);

  function stopAudio() {
    voiceRequest.current?.abort(); voiceRequest.current = null;
    audio.current?.pause(); audio.current = null;
    if (audioURL.current) URL.revokeObjectURL(audioURL.current);
    audioURL.current = null; release.current?.(); release.current = null;
  }

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setSession(detail?.route === route ? safeNovaContext(detail) : null);
    };
    window.addEventListener("nova-context", update);
    window.dispatchEvent(new Event("nova-context-request"));
    return () => {
      window.removeEventListener("nova-context", update);
      chatRequest.current?.abort(); voiceRequest.current?.abort(); speech.current?.stop(); stopAudio(); setNovaPanelOpen(false);
    };
  }, [route]);

  const context: NovaContext = session ? { ...session, ...(session.mode === "HEP" && plan ? { sourceName: plan.sourceFileName } : {}) } : {
    route,
    mode: route.startsWith("/story") ? "Story" : route.startsWith("/explore") ? "Explore" : route === "/progress" ? "Progress" : "HEP",
    ...(["/hep", "/quest"].includes(route) && plan ? { sourceName: plan.sourceFileName, summary: `${plan.exercises.length} selected exercises. ${frequencyInfo(plan.frequency).instruction}` } : {}),
    ...(route === "/progress" ? { summary: `${progress.length} saved completed sessions.` } : {}),
  };

  async function speak(message: Message, sourceQuestion: string) {
    if (!shouldAutoSpeakNova(voice, message.text)) return;
    stopAudio();
    const controller = new AbortController();
    voiceRequest.current = controller;
    try {
      let token = message.voiceToken;
      if (!token) {
        const result = await fetch("/api/nova", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: sourceQuestion, context }), signal: controller.signal,
        }).then(response => response.json());
        if (result.text !== message.text) return;
        token = result.voiceToken;
      }
      if (!token) throw new Error("Missing voice authorization");
      const response = await fetch("/api/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text, voiceToken: token }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!response.ok) throw new Error("Voice request failed");
      const blob = await response.blob();
      if (controller.signal.aborted || !blob.type.startsWith("audio/")) return;
      audioURL.current = URL.createObjectURL(blob);
      audio.current = new Audio(audioURL.current);
      release.current = beginNovaAudio();
      audio.current.onended = stopAudio;
      audio.current.onerror = stopAudio;
      await audio.current.play();
    } catch {
      if (!controller.signal.aborted) setError("Voice is unavailable. Nova's text answer is still here.");
    } finally {
      if (voiceRequest.current === controller) voiceRequest.current = null;
    }
  }

  async function ask(textOverride?: string) {
    const text = (textOverride ?? question).trim();
    if (!text || chatRequest.current || busy) return;
    stopAudio(); speech.current?.stop();
    setQuestion(""); setError("");
    const history = messages.slice(-6).map(({ role, text: historyText }) => ({ role, text: historyText }));
    setMessages(old => [...old.slice(-9), { role: "user", text }]);
    const known = deterministicNova(text, context);
    if (known) {
      const answer = { role: "assistant" as const, text: known.text };
      setMessages(old => [...old, answer]);
      if (shouldAutoSpeakNova(voice, answer.text)) void speak(answer, text);
      if (known.href) router.push(known.href);
      if (known.action === "reset" && session) window.dispatchEvent(new Event("nova-reset"));
      return;
    }

    const controller = new AbortController(); chatRequest.current = controller; setBusy(true);
    try {
      const response = await fetch("/api/nova", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, context, history }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40000)]),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.text !== "string") throw new Error();
      if (!controller.signal.aborted) {
        const answer = { role: "assistant" as const, text: data.text, voiceToken: data.voiceToken };
        setMessages(old => [...old, answer]);
        if (shouldAutoSpeakNova(voice, answer.text)) void speak(answer, text);
      }
    } catch {
      if (!controller.signal.aborted) setError("Nova couldn't respond. Try again, or ask about navigation or your session.");
    } finally {
      if (chatRequest.current === controller) { chatRequest.current = null; setBusy(false); }
    }
  }

  function listen() {
    if (listening) { speech.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || busy) return;
    stopAudio(); setError("");
    const recognizer = new Recognition(); speech.current = recognizer;
    recognizer.continuous = false; recognizer.interimResults = false; recognizer.lang = "en-US";
    recognizer.onstart = () => setListening(true);
    recognizer.onend = () => setListening(false);
    recognizer.onresult = event => {
      const result = event.results[event.results.length - 1];
      const latest = result?.[0]?.transcript ?? "";
      const final = finalSpeechQuestion(latest, result?.isFinal === true);
      if (final) { setQuestion(final); void ask(final); }
    };
    recognizer.onerror = () => { setListening(false); setError("Microphone unavailable. Type your question instead."); };
    try { recognizer.start(); }
    catch { setError("Microphone unavailable. Type your question instead."); }
  }

  function close() {
    setNovaPanelOpen(false); setOpen(false); speech.current?.stop(); chatRequest.current?.abort(); chatRequest.current = null;
    setBusy(false); stopAudio();
  }

  return <aside className="fixed bottom-4 left-4 z-[100] text-[#F4F6F2]">
    {open && <section role="dialog" aria-label="Ask Nova" className="mb-3 max-h-[75svh] w-[min(380px,calc(100vw-32px))] overflow-auto rounded-[24px] border border-white/25 bg-[#181C36] p-5 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Ask Nova</h2><button onClick={close} aria-label="Close Nova" className="rv-btn rv-btn-ghost">Close</button></div>
      <p className="mt-2 text-sm opacity-75">App help and your current quest. Leave out private health details.</p>
      <div role="log" aria-live="polite" className="my-4 space-y-3">{messages.map((message, index) => <div key={index} className="rounded-xl bg-white/5 p-3"><p className="text-sm font-bold">{message.role === "user" ? "You" : "Nova"}</p><p>{message.text}</p></div>)}</div>
      <form onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label htmlFor="global-nova-question" className="sr-only">Question for Nova</label>
        <div className={`flex items-end gap-2 rounded-2xl border bg-white/5 p-2 ${listening ? "border-[#F2C14E]" : "border-white/30"}`}>
          <textarea autoFocus id="global-nova-question" maxLength={600} rows={2} value={question}
            onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => { if (shouldSubmitNovaKey(event.key, event.shiftKey, event.nativeEvent.isComposing)) { event.preventDefault(); void ask(); } }}
            placeholder={listening ? "Listening…" : "Ask Nova anything about this screen"}
            className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 outline-none" />
          {supported && <button type="button" aria-pressed={listening} aria-label={listening ? "Stop listening" : "Ask with microphone"} onClick={listen}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${listening ? "border-[#F2C14E] bg-[#F2C14E] text-[#2A2410]" : "border-white/30"}`}>🎙</button>}
          <button disabled={busy || !question.trim()} aria-label="Send question" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2C14E] text-xl font-bold text-[#2A2410] disabled:opacity-40">↑</button>
        </div>
      </form>
      {listening && <p role="status" className="mt-2 text-sm text-[#F2C14E]">Listening… I’ll send when you finish speaking.</p>}
      {busy && <p role="status" className="rv-busy mt-3 text-sm">Nova is thinking…</p>}
      <button className={`mt-3 rounded-full border px-3 py-2 text-sm font-semibold ${voice ? "border-[#F2C14E] bg-[#F2C14E] text-[#2A2410]" : "border-white/30"}`}
        aria-pressed={voice} onClick={() => { setNovaVoicePreference(!voice); if (voice) stopAudio(); }}>
        Voice {voice ? "On" : "Off"}
      </button>
      <p className="mt-3 text-sm"><Link href="/">Home</Link> · <Link href="/hep">My HEP</Link></p>
      {error && <p role="status" className="mt-3 text-sm text-[#FFD89A]">{error}</p>}
    </section>}
    <button onClick={() => { if (open) close(); else { setNovaPanelOpen(true); setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)); setOpen(true); } }} aria-expanded={open} aria-label={open ? "Minimize Nova" : "Open Nova assistant"} className="flex items-center gap-2 rounded-full border border-white/30 bg-[#181C36] p-3 shadow-xl"><NovaMark />{open ? "Minimize" : "Nova"}</button>
  </aside>;
}
