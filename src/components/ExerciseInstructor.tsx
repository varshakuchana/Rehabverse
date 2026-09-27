"use client";

import NovaVoiceControl from "./NovaVoiceControl";
import { formatPrescription, type InstructorExercise, type InstructorMessage } from "@/lib/exerciseInstructor";

type ExerciseInstructorProps = {
  exercise: InstructorExercise;
  allowSpeech?: boolean;
} & (
  | { mode: "tutorial"; onReady: () => void }
  | { mode: "session"; message: InstructorMessage }
);

function NovaAvatar() {
  return (
    <div aria-hidden="true" className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-200/30 bg-gradient-to-br from-cyan-300/20 via-indigo-400/30 to-violet-500/20 shadow-[0_0_35px_#818cf830]">
      <svg viewBox="0 0 48 48" className="h-11 w-11 fill-none">
        <path d="m24 4 6 13 13 7-13 6-6 14-6-14L5 24l13-7Z" fill="#a5b4fc" fillOpacity=".2" stroke="#a5f3fc" />
        <path d="M17 24h2m10 0h2" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" />
        <path d="M21 30q3 3 6 0" stroke="#ecfeff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function ExerciseInstructor(props: ExerciseInstructorProps) {
  const { exercise } = props;
  if (props.mode === "session") {
    return (
      <section aria-label="Nova, your quest companion" className="mb-6 flex items-start gap-4 rounded-2xl border border-cyan-300/20 bg-indigo-400/10 p-5">
        <NovaAvatar />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">Nova · Quest companion</p>
          <p role="status" aria-atomic="true" className="text-sm leading-6 text-slate-200">{props.message.text}</p>
          <NovaVoiceControl message={props.message} allowed={props.allowSpeech} />
        </div>
      </section>
    );
  }

  const steps = [
    { title: "Find your starting position", text: exercise.positioning, detail: exercise.cameraRequirements },
    { title: "Bring the world to life", text: exercise.gameDescription },
    { title: "Start when you're ready", text: exercise.startInstruction },
  ];

  return (
    <section aria-labelledby="tutorial-title" className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-indigo-300/20 bg-slate-950/60 shadow-2xl shadow-indigo-950/50">
      <div className="grid lg:grid-cols-[.85fr_1.15fr]">
        <div className="border-b border-white/10 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-cyan-400/5 p-7 sm:p-10 lg:border-b-0 lg:border-r">
          <NovaAvatar />
          <NovaVoiceControl />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">Meet Nova · Your quest companion</p>
          <h1 id="tutorial-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A little movement.<br />A little magic.</h1>
          <p className="mt-5 leading-7 text-slate-300">I&apos;ll help you get set up and keep you company as you restore your world. Let&apos;s get familiar with this quest.</p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">{exercise.targetLabel ?? "Your movement"}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{exercise.name}</h2>
            <p className="mt-3 text-lg font-medium text-cyan-200">{formatPrescription(exercise.prescription)}</p>
          </div>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
            {exercise.instructions.map((instruction) => <li key={instruction} className="flex gap-3"><span aria-hidden="true" className="text-cyan-300">✦</span>{instruction}</li>)}
          </ul>
        </div>
        <div className="p-7 sm:p-10">
          <p className="mb-7 text-xs font-semibold uppercase tracking-[.2em] text-indigo-300">Before we begin</p>
          <ol className="space-y-7">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-300/20 bg-indigo-400/10 text-xs text-indigo-200">0{index + 1}</span>
                <div>
                  <h3 className="font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
                  {step.detail && <p className="mt-2 text-sm leading-6 text-cyan-200/80">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 rounded-xl border border-amber-200/10 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100/80">{exercise.safetyMessage}</p>
          <button onClick={props.onReady} className="mt-7 w-full rounded-xl bg-indigo-500 px-6 py-4 font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">I&apos;m Ready <span aria-hidden="true">→</span></button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-400">{exercise.nextStepMessage ?? "Next: enable your camera and get into position."}</p>
        </div>
      </div>
    </section>
  );
}
