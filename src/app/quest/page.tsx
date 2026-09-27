"use client";

import SiteNav from "@/components/SiteNav";
import Link from "next/link";
import IslandPresentation from "@/components/IslandPresentation";
import WorldPostcard from "@/components/WorldPostcard";
import HEPSchedule from "@/components/HEPSchedule";
import { useConfirmedPlan, useLocalDataStatus, useProgress } from "@/hooks/useProgress";
import { hepCapability, hepQuest } from "@/lib/hepQuests";
import { exerciseKey } from "@/lib/scheduleStorage";
import { localDateKey } from "@/lib/progressStorage";
import { THEMES, worldFor } from "@/lib/worldTheme";
import type { ConfirmedExercise } from "@/types/schedule";

function dose(ex: ConfirmedExercise) {
  const parts: string[] = [];
  if (ex.sets != null && ex.repetitions != null) parts.push(`${ex.sets} ${ex.sets === 1 ? "set" : "sets"} of ${ex.repetitions}`);
  else if (ex.repetitions != null) parts.push(`${ex.repetitions} reps`);
  else if (ex.sets != null) parts.push(`${ex.sets} ${ex.sets === 1 ? "set" : "sets"}`);
  if (ex.holdSeconds != null) parts.push(`hold ${ex.holdSeconds}s`);
  return parts.join(", ") || "Dose not given on your sheet";
}

export default function QuestPage() {
  const plan = useConfirmedPlan();
  const dataStatus = useLocalDataStatus();
  const sessions = useProgress();

  if (!plan) {
    return (
      <main id="main-content" tabIndex={-1} className="rv-home rv-scene relative isolate min-h-screen overflow-hidden bg-[linear-gradient(180deg,#1E2240_0%,#34355E_55%,#6A5C7D_100%)]">
        <IslandPresentation backdrop />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
          <SiteNav current="quest" />
          <div className="rv-glass mt-[12vh] max-w-lg rounded-[28px] p-8">
            <h1 className="font-display text-[clamp(34px,4vw,48px)] font-extrabold leading-none tracking-tight">
              {dataStatus === "loading" ? "Loading your plan…" : dataStatus === "unavailable" ? "Saved plan unavailable" : "No plan yet"}
            </h1>
            <p className="mt-3 text-[18px] opacity-85">
              {dataStatus === "unavailable" ? "Allow browser storage to use a saved plan. You can still explore general movements." : dataStatus === "loading" ? "Checking this browser for your confirmed plan." : "Upload the exercise sheet from your PT and check it. Your quest shows up here."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/hep" className="rv-btn rv-btn-primary">Upload my plan</Link>
              <Link href="/explore" className="rv-btn rv-btn-ghost">Try a movement</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const today = localDateKey(new Date());
  const sessionLink = (index: number) => `/session/squat?source=hep&plan=${encodeURIComponent(plan.id)}&exercise=${index}`;
  const stops = plan.exercises.map((exercise, index) => {
    const capability = hepCapability(exercise);
    const def = capability === "reference" ? null : hepQuest(plan, index);
    const world = def ? worldFor(def) : null;
    const doneToday = sessions.some(s => s.exerciseId === exerciseKey(plan, index) && s.completedLocalDate === today);
    return { exercise, index, capability, world, doneToday };
  });
  const playable = stops.filter(s => s.world);
  const next = playable.find(s => !s.doneToday);
  const doneCount = playable.filter(s => s.doneToday).length;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <main id="main-content" tabIndex={-1} className="rv-scene relative min-h-screen bg-[linear-gradient(180deg,#1E2240_0%,#2B2B52_60%,#3A3160_100%)]">
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <SiteNav current="quest" />

        <header className="flex flex-wrap items-end justify-between gap-6 pt-4">
          <div>
            <p className="opacity-80">{dateLabel}</p>
            <h1 className="mt-1 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[.93] tracking-tight">Today&apos;s quest</h1>
            <p className="mt-3 max-w-[48ch] text-[18px] opacity-85">
              {playable.length === 0 ? "None of your exercises can be played yet. They're listed below for reference."
                : doneCount === playable.length ? "Everything playable is done for today. Nice work."
                : `${doneCount} of ${playable.length} done today. Each exercise opens its own world.`}
            </p>
          </div>
          {next?.world && (
            <Link href={sessionLink(next.index)} className="rv-btn rv-btn-big border-0" style={{ background: THEMES[next.world].accent, color: THEMES[next.world].ink }}>
              {doneCount ? "Continue" : "Begin"}: {next.exercise.name} <span aria-hidden>→</span>
            </Link>
          )}
        </header>

        <ol className="relative mt-10 grid gap-4" aria-label="Exercises in your plan">
          <span aria-hidden className="absolute bottom-6 left-[27px] top-6 hidden border-l-2 border-dashed border-white/30 sm:block" />
          {stops.map(({ exercise, index, capability, world, doneToday }) => {
            const theme = world ? THEMES[world] : null;
            return (
              <li key={`${exercise.name}-${index}`} className="relative grid gap-4 sm:grid-cols-[56px_1fr]">
                <span aria-hidden className="relative z-10 mt-5 hidden h-14 w-14 place-items-center rounded-full border-[3px] font-display text-xl font-bold sm:grid"
                  style={{ borderColor: theme?.accent ?? "rgba(244,246,242,.35)", background: doneToday ? theme?.accent : "#1E2240", color: doneToday ? theme?.ink : "inherit" }}>
                  {doneToday ? "✓" : index + 1}
                </span>
                <article className={`grid overflow-hidden rounded-[24px] border bg-[rgba(24,28,54,.8)] md:grid-cols-[220px_1fr] ${theme ? "" : "opacity-80"}`} style={{ borderColor: theme ? `${theme.accent}66` : "rgba(244,246,242,.15)" }}>
                  <div className="relative min-h-32">
                    {world ? <WorldPostcard world={world} /> : <div className="grid h-full place-items-center bg-white/5 p-4 text-center text-[15px] opacity-70">Reference only</div>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl font-bold capitalize leading-tight">{exercise.name}</h2>
                      <p className="mt-1 text-[16px] opacity-85">{dose(exercise)}.</p>
                      {theme ? (
                        <p className="mt-1 text-[15px]"><span style={{ color: theme.accent }}>{theme.quest}.</span> <span className="opacity-75">{capability === "interactive" ? "The camera counts." : "You mark each rep; nothing is measured."}</span></p>
                      ) : (
                        <p className="mt-1 text-[15px] opacity-70">This needs a rep count (and, for follow-along, instructions) from your plan before it can be played.</p>
                      )}
                      {doneToday && <p className="mt-1 text-[15px] font-semibold" style={{ color: theme?.accent }}>Done today</p>}
                    </div>
                    {theme && (
                      <Link href={sessionLink(index)} className="rv-btn shrink-0 border-0" style={{ background: theme.accent, color: theme.ink }}>
                        {doneToday ? "Again" : capability === "interactive" ? "Play" : "Follow along"}
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>

        <div className="rv-quest-schedule mt-10"><HEPSchedule plan={plan} /></div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/hep" className="rv-btn rv-btn-ghost">Upload an updated plan</Link>
          <Link href="/progress" className="rv-btn rv-btn-ghost">Progress</Link>
        </div>
        {plan.frequency?.rawText && <p className="mt-6 text-[15px] opacity-75">Your plan says: {plan.frequency.rawText}</p>}
        <p className="mt-2 pb-8 text-[15px] opacity-75">From {plan.sourceFileName}, reviewed by you. Follow the instructions and limits in your care plan, and stop if anything hurts.</p>
      </div>
    </main>
  );
}
