"use client";
import SiteNav from "@/components/SiteNav";
import Link from "next/link";
import { useProgress, useLocalDataStatus } from "@/hooks/useProgress";
import { localDateKey, progressSummary } from "@/lib/progressStorage";
import type { CompletedSession } from "@/types/progress";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function lastDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i); out.push(localDateKey(x)); }
  return out;
}

function downloadForPT(sessions: CompletedSession[]) {
  const rows = [["Date", "Exercise", "Source", "Completed", "Target", "How it was counted", "Prescribed sets"]];
  for (const s of [...sessions].reverse()) rows.push([
    s.completedLocalDate, s.exerciseName, s.source === "hep" ? "My HEP" : "Explore",
    String(s.completedReps), String(s.targetReps),
    s.completionMethod === "self-reported" ? "Self-reported" : s.completionMethod === "camera-tracked" ? "Camera tracked" : "",
    s.prescribedSets ? String(s.prescribedSets) : "",
  ]);
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "rehabverse-progress.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function ProgressPage() {
  const sessions = useProgress();
  const dataStatus = useLocalDataStatus();
  const summary = progressSummary(sessions);
  const exercises = [...new Set(sessions.map(item => item.exerciseId))].map(id => {
    const history = sessions.filter(item => item.exerciseId === id);
    return { id, name: history[0].exerciseName, count: history.length, last: history[0].completedAt, source: history[0].source, dates: history.map(h => h.completedLocalDate) };
  });

  // Monday–Sunday strip for this week
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = DAY.map((label, i) => {
    const key = localDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    return { label, key, n: sessions.filter(s => s.completedLocalDate === key).length, today: key === localDateKey(now) };
  });
  const fortnight = lastDays(14);

  return (
    <main id="main-content" tabIndex={-1} className="rv-scene min-h-screen bg-[linear-gradient(180deg,#1E2240_0%,#2B2B52_60%,#3A3160_100%)]">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <SiteNav current="progress" />
        <header className="flex flex-wrap items-end justify-between gap-6 pt-4">
          <div>
            <p className="rv-eyebrow">Your movement journal</p>
            <h1 className="mt-1 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[.93] tracking-tight">Your progress</h1>
            <p className="mt-3 max-w-[48ch] text-[18px] opacity-85">Every finished quest is recorded here, on this device. Story fragments live on the Story map.</p>
          </div>
          {sessions.length > 0 && <button type="button" onClick={() => downloadForPT(sessions)} className="rv-btn rv-btn-primary">Download for my PT</button>}
        </header>

        <section aria-label="This week" className="rv-glass mt-8 rounded-[28px] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">This week</h2>
            <dl className="flex flex-wrap gap-6 text-right">
              {[["Sessions", summary.week], ["Active days", `${summary.activeDays} / 7`], ["All time", summary.total]].map(([label, value]) => (
                <div key={label}><dt className="text-[14px] opacity-70">{label}</dt><dd className="font-display text-3xl font-extrabold">{value}</dd></div>
              ))}
            </dl>
          </div>
          <ol className="mt-5 grid grid-cols-7 gap-2 text-center">
            {week.map(d => (
              <li key={d.key} className="grid justify-items-center gap-1.5">
                <span className={`text-[14px] ${d.today ? "font-bold" : "opacity-70"}`}>{d.label}</span>
                <span aria-label={`${d.label}: ${d.n} ${d.n === 1 ? "session" : "sessions"}${d.today ? ", today" : ""}`}
                  className={`grid h-12 w-12 place-items-center rounded-full border-2 font-display text-lg font-bold ${d.n ? "border-[#F2C14E] bg-[#F2C14E] text-[#2A2410] shadow-[0_0_24px_rgba(242,193,78,.45)]" : "border-white/25"} ${d.today ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#1c2140]" : ""}`}>
                  {d.n || ""}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[14px] opacity-65">Weeks run Monday to Sunday by the local date of each session. Several sessions on one day count as one active day.</p>
        </section>

        {!sessions.length ? (
          <section className="rv-glass my-10 rounded-[28px] p-8 text-center">
            <h2 className="font-display text-3xl font-bold">{dataStatus === "loading" ? "Loading your activity…" : dataStatus === "unavailable" ? "Progress storage is unavailable" : "Your story starts with one quest"}</h2>
            <p className="mx-auto mt-3 max-w-[46ch] opacity-85">{dataStatus === "unavailable" ? "Allow browser storage to read and save progress on this device." : dataStatus === "loading" ? "Checking this browser for saved sessions." : "Completed sessions show up here automatically."}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/quest" className="rv-btn rv-btn-primary">Today&apos;s quest</Link><Link href="/explore" className="rv-btn rv-btn-ghost">Try a movement</Link></div>
          </section>
        ) : <>
          <section className="my-10">
            <h2 className="font-display text-2xl font-bold">By exercise</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {exercises.map(exercise => (
                <article key={exercise.id} className="rv-glass rounded-[24px] p-5">
                  <h3 className="font-display text-xl font-bold">{exercise.name}</h3>
                  <p className="mt-1 text-[15px] opacity-80">{exercise.count} {exercise.count === 1 ? "session" : "sessions"}, {exercise.source === "hep" ? "My HEP" : "Explore"}. Last on {new Date(exercise.last).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p>
                  <div className="mt-4 flex h-10 items-end gap-1" role="img" aria-label={`Sessions per day over the last 14 days`}>
                    {fortnight.map(key => {
                      const n = exercise.dates.filter(d => d === key).length;
                      return <span key={key} className="flex-1 rounded-sm" style={{ height: n ? `${Math.min(100, 35 + n * 30)}%` : "8%", background: n ? "#F2C14E" : "rgba(244,246,242,.18)" }} />;
                    })}
                  </div>
                  <p className="mt-1 text-[13px] opacity-60">Last 14 days</p>
                </article>
              ))}
            </div>
          </section>

          <section className="my-10">
            <h2 className="font-display text-2xl font-bold">Recent sessions</h2>
            <ol className="mt-4 grid gap-2">
              {sessions.slice(0, 12).map(session => (
                <li key={session.id} className="rv-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
                  <div>
                    <p className="font-display text-lg font-bold">{session.exerciseName}</p>
                    <p className="text-[14px] opacity-75"><time dateTime={session.completedAt}>{new Date(session.completedAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>, {session.source === "hep" ? "my HEP" : "Explore"}{session.completionMethod === "self-reported" ? ", self-reported" : session.completionMethod === "camera-tracked" ? ", camera tracked" : ""}</p>
                  </div>
                  <div className="text-right text-[15px]">
                    <p className="font-semibold">{session.completedReps}/{session.targetReps} movements</p>
                    <p className="text-[13px] opacity-70">{session.completionMethod === "self-reported" ? "Self-reported completion" : `${session.score} points`}{session.prescribedSets ? `, ${session.prescribedSets} prescribed sets` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>}
        <footer className="mt-10 border-t border-white/15 py-5 text-[14px] leading-6 opacity-70">Stored in this browser on this device. Clearing browser data removes it. Nothing is synced to an account.</footer>
      </div>
    </main>
  );
}
