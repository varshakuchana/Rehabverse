"use client";
import Link from "next/link";
import { useState } from "react";
import { useProgress, useSchedules } from "@/hooks/useProgress";
import { DAY_NAMES, exerciseKey, frequencyInfo, saveSchedule } from "@/lib/scheduleStorage";
import { thisWeek } from "@/lib/progressStorage";
import type { ConfirmedPlan } from "@/types/schedule";

export default function HEPSchedule({ plan }: { plan: ConfirmedPlan }) {
  const sessions = useProgress();
  const schedules = useSchedules();
  const info = frequencyInfo(plan.frequency);
  const saved = schedules.find(item => item.planId === plan.id && item.frequencyKey === info.key);
  const week = thisWeek(sessions.filter(item => item.source === "hep" && item.planId === plan.id));
  return (
    <section className="my-8 rounded-3xl border border-indigo-300/20 bg-indigo-400/5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-widest text-cyan-300">Today / This Week</p><h2 className="mt-2 text-2xl font-semibold">Make room for your quest</h2></div>
        <div className="flex gap-4 text-sm text-cyan-200"><Link href="/quest">My Quest →</Link><Link href="/progress">View Progress →</Link></div>
      </div>
      <p className="mt-5 text-sm text-slate-400">Confirmed HEP frequency</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-100">{info.instruction}</p>
      {info.specified.length > 0 && <p className="mt-3 text-sm text-cyan-100">Days / timing from your HEP: {info.specified.join(", ")}</p>}
      {info.daily && <p className="mt-3 text-sm text-cyan-100">Your confirmed instruction is daily.</p>}
      {info.canChoose && <DayPicker key={`${plan.id}:${info.key}:${saved?.days.join(",") ?? "new"}`} planId={plan.id} frequencyKey={info.key} count={info.weekly!} initialDays={saved?.days ?? []} />}
      {saved && info.canChoose && <p role="status" className="mt-4 text-sm text-emerald-200">Saved on this device. Your preferred days: {saved.days.map(day => DAY_NAMES[day]).join(", ")}. {saved.days.includes(new Date().getDay()) ? "Today is one of your chosen days." : "Today is not one of your chosen days."}</p>}
      {info.weekly === undefined && <p className="mt-3 text-sm text-slate-400">Kept as the original instruction. No exact weekly target or schedule has been inferred.</p>}
      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="text-lg font-semibold">{week.length} exercise sessions completed this week</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">Monday–Sunday. Counts below are per exercise, not whole-plan visits. Explore sessions do not count toward your HEP.</p>
        <ul className="mt-4 space-y-3">
          {plan.exercises.map((exercise, index) => {
            const count = week.filter(item => item.exerciseId === exerciseKey(plan, index)).length;
            return <li key={index} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-950/40 p-4 text-sm"><span>{exercise.name}</span><span className="text-cyan-200">{count} completed{info.weekly !== undefined ? ` · ${Math.max(0, info.weekly - count)} remaining of ${info.weekly} planned this week` : ""}</span></li>;
          })}
        </ul>
      </div>
    </section>
  );
}

function DayPicker({ planId, frequencyKey, count, initialDays }: { planId: string; frequencyKey: string; count: number; initialDays: number[] }) {
  const [days, setDays] = useState(initialDays);
  const [message, setMessage] = useState("");
  return (
    <fieldset className="mt-5">
      <legend className="font-medium">Choose the days that work best for your schedule.</legend>
      <p className="mt-2 text-xs leading-5 text-slate-400">Choose {count} preferred days. These are your preferences, not therapist-recommended days. They are saved here; no notifications are sent.</p>
      <div className="mt-3 flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map(day => <button key={day} type="button" aria-pressed={days.includes(day)} disabled={!days.includes(day) && days.length >= count} onClick={() => { setMessage(""); setDays(days.includes(day) ? days.filter(value => value !== day) : [...days, day]); }} className={`rounded-xl border px-3 py-2 text-sm disabled:opacity-30 ${days.includes(day) ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/15 text-slate-300"}`}>{DAY_NAMES[day]}</button>)}</div>
      <button type="button" disabled={days.length !== count} onClick={() => { try { saveSchedule({ planId, frequencyKey, days }); setMessage("Schedule saved on this device."); } catch { setMessage("Could not save your schedule. Browser storage may be unavailable."); } }} className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold disabled:opacity-40">Save preferred days</button>
      <p role="status" className="mt-2 text-sm text-slate-300">{message}</p>
    </fieldset>
  );
}
