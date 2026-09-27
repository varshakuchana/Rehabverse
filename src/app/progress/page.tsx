"use client";
import SiteNav from "@/components/SiteNav";
import Link from "next/link";
import { useProgress, useLocalDataStatus } from "@/hooks/useProgress";
import { progressSummary } from "@/lib/progressStorage";

export default function ProgressPage() {
  const sessions = useProgress();
  const dataStatus = useLocalDataStatus();
  const summary = progressSummary(sessions);
  const exercises = [...new Set(sessions.map(item => item.exerciseId))].map(id => {
    const history = sessions.filter(item => item.exerciseId === id);
    return { id, name: history[0].exerciseName, count: history.length, last: history[0].completedAt, source: history[0].source };
  });
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <SiteNav current="progress" />
        <header className="my-12"><p className="text-xs uppercase tracking-[.25em] text-cyan-300">Your movement journal</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Every quest leaves a spark.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-300">A record of the sessions you completed and the time you made for movement. This is activity history, not a measure of medical improvement.</p></header>
        <div className="grid gap-4 sm:grid-cols-3">{[["Completed sessions", summary.total], ["Completed this week", summary.week], ["Active days this week", `${summary.activeDays} / 7`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-indigo-300/20 bg-white/5 p-6"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-4xl font-bold text-cyan-200">{value}</p></div>)}</div>
        <p className="mt-3 text-xs text-slate-400">Weeks run Monday–Sunday using the local dates recorded at completion. Multiple sessions on one day count as one active day.</p>
        {!sessions.length ? <section className="my-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h2 className="text-2xl font-semibold">{dataStatus === "loading" ? "Loading your activity…" : dataStatus === "unavailable" ? "Progress storage is unavailable" : "Your story starts with one quest."}</h2><p className="mt-3 text-slate-400">{dataStatus === "unavailable" ? "Allow browser storage to read and save progress on this device." : dataStatus === "loading" ? "Checking this browser for saved sessions." : "Completed sessions will appear here automatically."}</p><Link href="/explore" className="mt-6 inline-block rounded-xl bg-indigo-500 px-6 py-3 font-semibold">Explore a Movement Quest →</Link></section> : <>
          <section className="my-10"><h2 className="mb-5 text-2xl font-semibold">Recent activity</h2><ol className="space-y-3">{sessions.slice(0, 12).map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"><div><p className="font-semibold">✦ {session.exerciseName}</p><p className="mt-2 text-xs text-slate-400"><time dateTime={session.completedAt}>{new Date(session.completedAt).toLocaleString()}</time> · {session.source === "hep" ? "My HEP" : "Explore"}{session.completionMethod === "self-reported" ? " · Guided / self-reported" : session.completionMethod === "camera-tracked" ? " · Camera tracked" : ""}</p></div><div className="text-right"><p className="text-sm text-emerald-200">Complete · {session.completedReps}/{session.targetReps} movements</p><p className="mt-2 text-xs text-slate-400">{session.score} game points{session.prescribedSets ? ` · ${session.prescribedSets} prescribed sets` : ""}</p></div></li>)}</ol></section>
          <section className="my-10"><h2 className="mb-5 text-2xl font-semibold">Exercise completion history</h2><div className="grid gap-4 sm:grid-cols-2">{exercises.map(exercise => <article key={exercise.id} className="rounded-2xl border border-white/10 p-5"><h3 className="font-semibold">{exercise.name}</h3><p className="mt-2 text-cyan-200">{exercise.count} completed sessions · {exercise.source === "hep" ? "My HEP" : "Explore"}</p><p className="mt-2 text-xs text-slate-400">Most recent: {new Date(exercise.last).toLocaleDateString()}</p></article>)}</div></section>
        </>}
        <footer className="mt-10 border-t border-white/10 py-5 text-xs leading-6 text-slate-400">Demo data is stored in this browser on this device. Clearing browser data removes it. Nothing is synced to an account.</footer>
      </div>
    </main>
  );
}
