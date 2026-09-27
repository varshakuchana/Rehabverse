"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { catalogQuest, queryExploreCatalog } from "@/lib/exerciseCatalog";
import { NovaMark } from "@/components/NovaMark";
import WorldPostcard from "@/components/WorldPostcard";
import { THEMES, worldFor } from "@/lib/worldTheme";
import { isMedicalRequest, MEDICAL_REDIRECT, WELLNESS_LABEL } from "@/lib/exploreSafety";
import { validateExploreQuest, type ExploreQuest } from "@/lib/exploreQuest";
import { saveExploreQuest } from "@/lib/exploreQuestStorage";
export default function ExploreNovaCreator() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [quest, setQuest] = useState<ExploreQuest | null>(null);
  const [error, setError] = useState("");
  const [medical, setMedical] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);
  async function create() {
    if (requestRef.current || !prompt.trim()) return;
    setError(""); setQuest(null); setMedical(false);
    if (isMedicalRequest(prompt)) { setMedical(true); return; }
    const controller = new AbortController(); requestRef.current = controller; setLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch("/api/explore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }), signal: controller.signal });
      const data = await response.json();
      if (requestRef.current !== controller) return;
      if (data.kind === "medical") { setMedical(true); return; }
      const valid = validateExploreQuest(data.quest);
      if (!response.ok || !valid) throw new Error(data.error || "Nova returned a quest outside the supported library. Try again.");
      setQuest(valid);
    } catch (e) {
      if (requestRef.current !== controller) return;
      setError(controller.signal.aborted ? "Quest creation timed out. Try again or choose a built-in quest." : e instanceof Error ? e.message : "Quest creation is unavailable.");
    } finally { window.clearTimeout(timeout); if (requestRef.current === controller) { requestRef.current = null; setLoading(false); } }
  }
  function launch() {
    if (!quest || launching) return;
    try { saveExploreQuest(quest); setLaunching(true); router.push("/explore/quest"); }
    catch { setError("Allow browser storage to launch this quest. Built-in experiences are still available below."); }
  }
  const ideas = ["A gentle upper-body break", "Something for my legs", "A short break I can do seated"];
  return <section aria-labelledby="nova-create-title" className="rv-glass relative overflow-hidden rounded-[28px] p-7 sm:p-9">
    <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#B69CFF]/25 blur-3xl" />
    <div className="relative flex items-center gap-3"><NovaMark size={44} /><div><p className="rv-eyebrow">Ask Nova</p><h2 id="nova-create-title" className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-none tracking-tight">Build me a quest</h2></div></div>
    <p className="relative mt-4 max-w-[58ch] text-[17px] leading-snug opacity-90">Nova builds general wellness quests from supported RehabVerse movements.</p>
    <form onSubmit={e => { e.preventDefault(); void create(); }} className="relative mt-5">
      <label htmlFor="nova-request" className="block font-display text-lg font-semibold">What would you like?</label>
      <textarea id="nova-request" maxLength={600} rows={2} required disabled={loading || launching} value={prompt} onChange={e => { setPrompt(e.target.value); setQuest(null); setMedical(false); setError(""); }} placeholder="A light upper-body movement break"
        className="mt-2 w-full resize-none rounded-2xl border-2 border-white/25 bg-[rgba(12,14,30,.55)] p-4 text-[18px] outline-none transition placeholder:text-white/40 focus:border-[#B69CFF]" />
      <div className="mt-3 flex flex-wrap gap-2">
        {ideas.map(idea => (
          <button key={idea} type="button" disabled={loading || launching} onClick={() => { setPrompt(idea); setQuest(null); setMedical(false); setError(""); }}
            className="min-h-10 rounded-full border border-white/30 px-4 text-[15px] transition hover:bg-white/10">{idea}</button>
        ))}
      </div>
      <p className="mt-3 text-[14px] opacity-70">Your text goes to Gemini, so leave out health details and personal information. Camera images and plan documents are never sent from here. {WELLNESS_LABEL}</p>
      <button disabled={loading || launching || !prompt.trim()} className="rv-btn mt-5 border-0 bg-[#B69CFF] text-[#1B1535] hover:brightness-110">{loading ? "Nova is choosing…" : "Create my quest"}</button>
    </form>
    {loading && <p role="status" className="rv-busy relative mt-4 text-[16px]">Checking your request against the supported movements…</p>}
    {error && <p role="alert" className="relative mt-4 text-[16px] text-[#FFD89A]">{error}</p>}
    {medical && <div role="status" className="relative mt-5 rounded-2xl border border-white/25 bg-white/5 p-5"><div className="flex gap-3"><NovaMark /><p className="text-[16px] leading-snug">{MEDICAL_REDIRECT}</p></div><Link href="/hep" className="rv-link mt-3 inline-block font-semibold text-[#F2C14E]">Upload your plan instead</Link></div>}
    {quest && <div className="relative mt-6 rounded-[24px] border border-white/20 bg-[rgba(12,14,30,.5)] p-6">
      <h3 className="font-display text-2xl font-bold">{quest.title}</h3>
      <p className="mt-1 text-[16px] opacity-85">{quest.description} Take as long as you like.</p>
      <ol className="mt-5 grid gap-3">{quest.exercises.map((step, index) => {
        const entry = queryExploreCatalog().find(item => item.id === step.exerciseId)!;
        const def = catalogQuest(step.exerciseId, step.targetReps);
        const world = def ? worldFor(def) : "orbit";
        return <li key={step.exerciseId} className="grid grid-cols-[96px_1fr] items-center gap-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[.04] pr-4">
          <div className="h-full min-h-20"><WorldPostcard world={world} /></div>
          <div className="py-3">
            <p className="font-display text-lg font-bold">{index + 1}. {entry.name}, {step.targetReps} movements</p>
            <p className="text-[15px]" style={{ color: THEMES[world].accent }}>{THEMES[world].quest}. {entry.capability === "interactive" ? "Camera tracked." : "Guided · self-reported."}</p>
          </div>
        </li>;
      })}</ol>
      <button onClick={launch} disabled={launching} className="rv-btn rv-btn-primary mt-5">{launching ? "Opening quest…" : "Meet Nova and begin →"}</button>
    </div>}
  </section>;
}
