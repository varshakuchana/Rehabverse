"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { queryExploreCatalog } from "@/lib/exerciseCatalog";
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
  return <section aria-labelledby="nova-create-title" className="mb-12 rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-indigo-500/15 to-cyan-400/5 p-6 sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Your preferences · Our supported library</p><h2 id="nova-create-title" className="mt-3 text-3xl font-bold">Explore with Nova</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">No exercise plan? Tell Nova what kind of general movement experience you want. Nova selects from our camera-tracked games and Guided fallback—never new exercises or treatment routines.</p><p className="mt-3 text-xs text-cyan-100">{WELLNESS_LABEL}</p><form onSubmit={e => { e.preventDefault(); void create(); }} className="mt-6"><label htmlFor="nova-request" className="block text-sm font-semibold">What kind of movement break would you like?</label><textarea id="nova-request" maxLength={600} rows={3} required disabled={loading || launching} value={prompt} onChange={e => { setPrompt(e.target.value); setQuest(null); setMedical(false); setError(""); }} placeholder="A light upper-body movement break" className="mt-3 w-full rounded-xl border border-indigo-300/30 bg-slate-950/70 p-4 text-white" /><p className="mt-2 text-xs text-slate-400">Your text request goes to Gemini. Please leave out health details and personal information. Camera images and HEP documents are never sent by this creator.</p><button disabled={loading || launching || !prompt.trim()} className="mt-4 rounded-xl bg-cyan-300 px-6 py-3 font-semibold text-slate-950 disabled:opacity-40">{loading ? "Nova is choosing your quest…" : "Create my movement quest"}</button></form>{loading && <p role="status" className="mt-4 text-sm text-slate-300">Checking your preferences against supported experiences…</p>}{error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}{medical && <div role="status" className="mt-5 rounded-xl border border-indigo-300/30 p-5"><p className="text-sm leading-6">{MEDICAL_REDIRECT}</p><Link href="/hep" className="mt-4 inline-block font-semibold text-cyan-200">Upload in My HEP →</Link></div>}{quest && <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5"><h3 className="text-xl font-semibold">{quest.title}</h3><p className="mt-2 text-sm text-slate-300">{quest.description} Timing is up to you; this is not an exact-duration workout.</p><ol className="mt-4 space-y-3">{quest.exercises.map((step, index) => { const entry = queryExploreCatalog().find(item => item.id === step.exerciseId)!; return <li key={step.exerciseId} className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{index + 1}. {entry.name} · {step.targetReps} movements</p><p className="mt-2 text-xs text-cyan-200">{entry.capability === "interactive" ? "Interactive · Camera tracked" : "Guided · You mark completion"}</p><p className="mt-2 text-sm text-slate-400">{entry.cameraRequirements}</p></li>; })}</ol><button onClick={launch} disabled={launching} className="mt-5 rounded-xl bg-indigo-500 px-6 py-3 font-semibold disabled:opacity-40">{launching ? "Opening quest…" : "Meet Nova & begin →"}</button></div>}</section>;
}
