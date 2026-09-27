"use client";
import { compareHEPs } from "@/lib/compareHEPs";
import { compatibleSchedule, DAY_NAMES, frequencyInfo } from "@/lib/scheduleStorage";
import { useSchedules } from "@/hooks/useProgress";
import type { ConfirmedExercise, ConfirmedPlan, ExtractedHEP } from "@/types/schedule";
import type { ChangeCategory, FieldDifference } from "@/types/hepComparison";

const categoryStyles: Record<ChangeCategory, string> = {
  Added: "border-emerald-300/25 bg-emerald-300/5 text-emerald-200",
  Removed: "border-rose-300/25 bg-rose-300/5 text-rose-200",
  Changed: "border-amber-300/25 bg-amber-300/5 text-amber-200",
  Unchanged: "border-slate-400/20 bg-slate-400/5 text-slate-300",
};
function Differences({ fields }: { fields: FieldDifference[] }) {
  return <dl className="mt-4 space-y-4">{fields.map(field => <div key={field.field}><dt className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{field.field}</dt><dd className="grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]"><div className="whitespace-pre-wrap break-words rounded-xl bg-slate-950/40 p-3 text-slate-300"><span className="mb-1 block text-xs text-slate-500">Current</span>{field.before}</div><span aria-hidden="true" className="self-center text-center text-indigo-300">→</span><div className="whitespace-pre-wrap break-words rounded-xl bg-indigo-400/10 p-3 text-white"><span className="mb-1 block text-xs text-indigo-300">Updated</span>{field.after}</div></dd></div>)}</dl>;
}
function ExerciseDetails({ exercise }: { exercise: ConfirmedExercise }) {
  const dose = [exercise.sets == null ? null : `${exercise.sets} sets`, exercise.repetitions == null ? null : `${exercise.repetitions} reps`, exercise.holdSeconds == null ? null : `${exercise.holdSeconds} second hold`].filter(Boolean).join(" · ");
  return <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300"><p>{dose || "Dosage not specified"}</p>{exercise.instructions && <p className="whitespace-pre-wrap">Instructions: {exercise.instructions}</p>}{exercise.notes && <p className="whitespace-pre-wrap">Notes: {exercise.notes}</p>}</div>;
}
export default function PlanUpdateReview({ currentPlan, extracted, sourceFileName, onConfirm, onCancel, error, saving, storageAvailable = true }: {
  currentPlan: ConfirmedPlan;
  extracted: ExtractedHEP;
  sourceFileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  error: string;
  saving: boolean;
  storageAvailable?: boolean;
}) {
  const schedules = useSchedules();
  const candidate = { ...extracted, sourceFileName, id: "preview", uploadedAt: "", confirmed: false };
  const comparison = compareHEPs(currentPlan, candidate);
  const preserved = compatibleSchedule(currentPlan, candidate, schedules);
  const info = frequencyInfo(extracted.frequency);
  return <section tabIndex={-1} id="hep-comparison" aria-labelledby="update-title" className="mx-auto mt-14 max-w-5xl scroll-mt-8 pb-16">
    <header className="rounded-3xl border border-indigo-300/20 bg-gradient-to-br from-indigo-400/10 to-cyan-300/5 p-7 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Plan Update Review</p><h2 id="update-title" className="mt-3 text-3xl font-bold">Review what changed before updating your RehabVerse plan.</h2><p className="mt-4 text-sm leading-6 text-slate-300">Your current plan stays active until you confirm. This comparison shows your current plan against your selected, corrected update; it does not interpret why they changed.</p><p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">AI extraction may make mistakes. Compare the extracted plan with your actual HEP before confirming.</p></header>
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{(Object.keys(categoryStyles) as ChangeCategory[]).map(category => <div key={category} className={`rounded-2xl border p-4 ${categoryStyles[category]}`}><p className="text-sm">{category}</p><p className="mt-2 text-3xl font-semibold">{comparison.exercises.filter(item => item.category === category).length}</p></div>)}</div>
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6"><h3 className="text-lg font-semibold">Plan-level changes</h3>{comparison.planFields.length ? <Differences fields={comparison.planFields} /> : <p className="mt-3 text-sm text-slate-400">No changes to frequency, general instructions, or source filename.</p>}<p className="mt-4 text-sm text-slate-300">Updated frequency instruction: {info.instruction}</p></section>
    {comparison.hasDuplicateNames && <p className="mb-5 rounded-xl border border-amber-300/20 p-4 text-sm text-amber-100">Some exercise names appear more than once. Identical entries were matched first, then remaining entries in document order. Please double-check these matches.</p>}
    <div className="space-y-4">{comparison.exercises.map((item, index) => <article key={index} className={`rounded-2xl border p-6 ${categoryStyles[item.category]}`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">{(item.after ?? item.before)!.name}</h3><span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">{item.category}</span></div>{item.fields.length > 0 ? <><Differences fields={item.fields} /><details className="mt-4 text-sm text-slate-300"><summary className="cursor-pointer">Full updated entry</summary><ExerciseDetails exercise={item.after!} /></details></> : <ExerciseDetails exercise={(item.after ?? item.before)!} />}</article>)}</div>
    {extracted.extractionNotes.length > 0 && <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6"><h3 className="font-semibold text-amber-200">Please double-check</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">{extracted.extractionNotes.map((note, i) => <li key={i}>{note}</li>)}</ul></div>}
    <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-6"><h3 className="font-semibold">Your schedule and history</h3><p className="mt-3 text-sm leading-6 text-slate-300">Previous completed sessions will stay in Progress with their original plan.</p><p className="mt-2 text-sm leading-6 text-cyan-100">{preserved ? `Your preferred days (${preserved.days.map(day => DAY_NAMES[day]).join(", ")}) remain compatible and will carry over.` : info.canChoose ? "Choose the days that work best for your schedule. After confirming, select preferred days again on My Quest; no new days will be assigned automatically." : info.specified.length ? `The updated HEP specifies: ${info.specified.join(", ")}. These instructions take precedence over previous preferences.` : info.daily ? "The updated instruction is daily. Previous preferred days will not override it." : "The original frequency instruction will be preserved. No exact schedule will be inferred."}</p></div>
    <div className="mt-8 rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-6"><p className="text-sm text-slate-300">Confirm only after comparing this review with the HEP you received.</p>{!extracted.exercises.length && <p className="mt-3 text-sm text-amber-200">Select at least one exercise above before replacing your plan.</p>}{error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}<div className="mt-5 flex flex-wrap gap-3"><button disabled={saving || !storageAvailable || !extracted.exercises.length} onClick={onConfirm} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400 disabled:opacity-40">{saving ? "Saving…" : "Confirm Updated HEP"}</button><button disabled={saving} onClick={onCancel} className="rounded-xl border border-white/20 px-5 py-3 text-slate-200">Keep Current Plan</button></div></div>
  </section>;
}
