"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocalDataStatus } from "@/hooks/useProgress";
import { subscribeStorage } from "@/lib/demoStorage";
import { decodeExploreQuest, readExploreQuest } from "@/lib/exploreQuestStorage";
import { generatedStep, type ExploreQuest } from "@/lib/exploreQuest";
import { WELLNESS_LABEL } from "@/lib/exploreSafety";
import QuestExperience from "@/components/QuestExperience";
const serverSnapshot = () => null;
export default function NovaQuestPage() {
  const status = useLocalDataStatus();
  const raw = useSyncExternalStore(subscribeStorage, readExploreQuest, serverSnapshot);
  const quest = useMemo(() => decodeExploreQuest(raw), [raw]);
  if (status === "loading") return <main id="main-content" className="p-8 text-white" role="status">Loading your Nova quest…</main>;
  if (!quest) return <main id="main-content" className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl">Open a quest from Explore with Nova</h1><p className="mt-3 text-slate-400">Your generated quest must be available in this browser and match the supported library.</p><Link href="/explore" className="mt-6 inline-block text-cyan-200">← Explore with Nova</Link></main>;
  return <QuestJourney key={raw} quest={quest} />;
}
function QuestJourney({ quest }: { quest: ExploreQuest }) {
  // Only the journey index lives here. Each existing session owns its own reps,
  // countdown, score and save. Advance only from its saved-completion action.
  const [index, setIndex] = useState(0);
  const step = quest.exercises[index];
  if (!step) return <main id="main-content" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-6 text-white"><section className="max-w-xl rounded-3xl border border-cyan-300/30 bg-white/5 p-8 text-center"><div aria-hidden="true" className="text-6xl text-cyan-200">✦</div><h1 className="mt-5 text-3xl font-bold">Quest complete. Gardens restored.</h1><p className="mt-4 text-slate-300">You completed all {quest.exercises.length} experiences. Each is saved separately in Progress as Explore activity.</p><p className="mt-4 text-xs text-slate-400">{WELLNESS_LABEL}</p><div className="mt-6 flex flex-wrap justify-center gap-4"><Link href="/progress" className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">View Progress →</Link><Link href="/explore" className="rounded-xl border border-white/20 px-5 py-3">Back to Explore</Link></div></section></main>;
  const definition = generatedStep(step)!;
  return <><div className="border-b border-cyan-300/20 bg-slate-950 px-5 py-4 text-center text-sm text-cyan-100" role="status">Nova Quest · Experience {index + 1} of {quest.exercises.length}<span className="mt-1 block text-xs text-slate-400">{WELLNESS_LABEL} Reloading restarts the journey; completed activity stays in Progress.</span></div><QuestExperience key={index} definition={definition} onContinue={() => setIndex(current => current === index ? index + 1 : current)} /></>;
}
