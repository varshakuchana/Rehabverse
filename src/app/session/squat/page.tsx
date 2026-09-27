"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useConfirmedPlan, useLocalDataStatus } from "@/hooks/useProgress";
import { hepQuest } from "@/lib/hepQuests";
import { exercises } from "@/data/exercises";
import QuestExperience from "@/components/QuestExperience";
export default function MovementQuestPage() {
  return <Suspense fallback={<main id="main-content" className="p-8 text-white">Loading quest…</main>}><QuestEntry /></Suspense>;
}
function QuestEntry() {
  const params = useSearchParams();
  const plan = useConfirmedPlan();
  const status = useLocalDataStatus();
  const hep = params.get("source") === "hep";
  if (hep && status === "loading") return <main id="main-content" className="p-8 text-white" role="status">Loading your HEP…</main>;
  const index = Number(params.get("exercise"));
  const definition = hep ? (plan && plan.id === params.get("plan") && params.has("exercise") && Number.isInteger(index) ? hepQuest(plan, index) : null)
    : exercises.find(item => item.id === (params.get("exercise") ?? "squat"))?.quest;
  if (!definition) return <main id="main-content" className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl">This quest is unavailable.</h1><p className="my-4">Open a supported quest from your current plan or Explore.</p><Link href={hep ? "/quest" : "/explore"} className="text-cyan-200">← Back to {hep ? "My HEP" : "Explore"}</Link><Link href="/" className="ml-4 text-cyan-200">Home</Link></main>;
  return <QuestExperience key={JSON.stringify(definition)} definition={definition} />;
}
