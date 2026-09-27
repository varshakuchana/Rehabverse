"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocalDataStatus } from "@/hooks/useProgress";
import { subscribeStorage } from "@/lib/demoStorage";
import { decodeExploreQuest, readExploreQuest } from "@/lib/exploreQuestStorage";
import { generatedStep, type ExploreQuest } from "@/lib/exploreQuest";
import { WELLNESS_LABEL } from "@/lib/exploreSafety";
import QuestExperience from "@/components/QuestExperience";
import WorldPostcard from "@/components/WorldPostcard";
const serverSnapshot = () => null;
export default function NovaQuestPage() {
  const status = useLocalDataStatus();
  const raw = useSyncExternalStore(subscribeStorage, readExploreQuest, serverSnapshot);
  const quest = useMemo(() => decodeExploreQuest(raw), [raw]);
  if (status === "loading") return <main id="main-content" className="rv-scene min-h-screen bg-[#1E2240] p-8" role="status">Loading your Nova quest…</main>;
  if (!quest) return <main id="main-content" className="rv-scene grid min-h-screen place-items-center bg-[linear-gradient(180deg,#1E2240,#3A3160)] p-6"><div className="rv-glass max-w-lg rounded-[28px] p-8"><h1 className="font-display text-3xl font-extrabold">Ask Nova for a quest first</h1><p className="mt-3 opacity-85">Your quest needs to be saved in this browser and match the supported movements.</p><Link href="/explore" className="rv-btn rv-btn-primary mt-6">Back to Explore</Link></div></main>;
  return <QuestJourney key={raw} quest={quest} />;
}
function QuestJourney({ quest }: { quest: ExploreQuest }) {
  // Only the journey index lives here. Each existing session owns its own reps,
  // countdown, score and save. Advance only from its saved-completion action.
  const [index, setIndex] = useState(0);
  const step = quest.exercises[index];
  if (!step) return <main id="main-content" className="rv-scene grid min-h-screen place-items-center bg-[linear-gradient(180deg,#1E2240,#3A3160)] p-6">
    <section className="rv-glass max-w-xl rounded-[28px] p-8 text-center">
      <div aria-hidden className="mx-auto grid w-fit grid-cols-4 gap-2">{(["well", "flock", "cairn", "orbit"] as const).map(w => <div key={w} className="h-12 w-16 overflow-hidden rounded-xl"><WorldPostcard world={w} /></div>)}</div>
      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">Quest complete</h1>
      <p className="mt-3 text-[18px] opacity-90">You finished all {quest.exercises.length} parts of Nova&apos;s quest. Each one is saved in Progress as Explore activity.</p>
      <p className="mt-3 text-[14px] opacity-65">{WELLNESS_LABEL}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/progress" className="rv-btn rv-btn-primary">Progress</Link><Link href="/explore" className="rv-btn rv-btn-ghost">Back to Explore</Link></div>
    </section>
  </main>;
  const definition = generatedStep(step)!;
  return <><div role="status" title={`${WELLNESS_LABEL} Reloading restarts the journey; completed activity stays in Progress.`} className="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-[#B69CFF]/60 bg-[rgba(27,21,53,.85)] px-4 py-2 text-[14px] text-[#F4F6F2] backdrop-blur-md">Nova&apos;s quest: part {index + 1} of {quest.exercises.length}</div><QuestExperience key={index} definition={definition} onContinue={() => setIndex(current => current === index ? index + 1 : current)} /></>;
}
