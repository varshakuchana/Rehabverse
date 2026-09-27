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
    <section className="rv-glass my-8 rounded-[28px] p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="rv-eyebrow">This week</p><h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Make room for your quest</h2></div>
        <div className="flex gap-4 text-[15px] text-[#F2C14E]"><Link href="/quest">My Quest →</Link><Link href="/progress">View Progress →</Link></div>
      </div>
      <p className="mt-5 text-sm opacity-70">Confirmed HEP frequency</p>
      <p className="mt-1 whitespace-pre-wrap ">{info.instruction}</p>
      {info.specified.length > 0 && <p className="mt-3 text-sm text-[#F4F6F2]">Days / timing from your HEP: {info.specified.join(", ")}</p>}
      {info.daily && <p className="mt-3 text-sm text-[#F4F6F2]">Your confirmed instruction is daily.</p>}
      {info.canChoose && <DayPicker key={`${plan.id}:${info.key}:${saved?.days.join(",") ?? "new"}`} planId={plan.id} frequencyKey={info.key} count={info.weekly!} initialDays={saved?.days ?? []} />}
      {saved && info.canChoose && <p role="status" className="mt-4 text-sm text-[#F2C14E]">Saved on this device. Your preferred days: {saved.days.map(day => DAY_NAMES[day]).join(", ")}. {saved.days.includes(new Date().getDay()) ? "Today is one of your chosen days." : "Today is not one of your chosen days."}</p>}
      {info.weekly === undefined && <p className="mt-3 text-sm opacity-70">Kept as the original instruction. No exact weekly target or schedule has been inferred.</p>}
      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="text-lg font-semibold">{week.length} exercise sessions completed this week</p>
        <p className="mt-2 text-xs leading-5 opacity-70">Monday–Sunday. Counts below are per exercise, not whole-plan visits. Explore sessions do not count toward your HEP.</p>
        <ul className="mt-4 space-y-3">
          {plan.exercises.map((exercise, index) => {
            const count = week.filter(item => item.exerciseId === exerciseKey(plan, index)).length;
            return <li key={index} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-white/[.06] px-4 py-3 text-[15px]"><span>{exercise.name}</span><span className="text-[#F2C14E]">{count} completed{info.weekly !== undefined ? ` · ${Math.max(0, info.weekly - count)} remaining of ${info.weekly} planned this week` : ""}</span></li>;
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
      <p className="mt-2 text-xs leading-5 opacity-70">Choose {count} preferred days. These are your preferences, not therapist-recommended days. They are saved here; no notifications are sent.</p>
      <div className="mt-3 flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map(day => <button key={day} type="button" aria-pressed={days.includes(day)} disabled={!days.includes(day) && days.length >= count} onClick={() => { setMessage(""); setDays(days.includes(day) ? days.filter(value => value !== day) : [...days, day]); }} className={`min-h-11 rounded-full border-2 px-4 text-[15px] font-semibold transition disabled:opacity-30 ${days.includes(day) ? "border-[#F2C14E] bg-[#F2C14E] text-[#2A2410]" : "border-white/35 hover:bg-white/10"}`}>{DAY_NAMES[day]}</button>)}</div>
      <button type="button" disabled={days.length !== count} onClick={() => { try { saveSchedule({ planId, frequencyKey, days }); setMessage("Schedule saved on this device."); } catch { setMessage("Could not save your schedule. Browser storage may be unavailable."); } }} className="rv-btn rv-btn-primary mt-4 min-h-12 px-6">Save preferred days</button>
      <p role="status" className="mt-2 text-sm opacity-85">{message}</p>
    </fieldset>
  );
}
