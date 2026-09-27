"use client";

import { NovaMark } from "./NovaMark";
import NovaVoiceControl from "./NovaVoiceControl";
import DemoFigure, { type DemoKind } from "./DemoFigure";
import { THEMES } from "@/lib/worldTheme";
import type { WorldKind } from "@/lib/rehabWorld/worlds";
import type { CSSProperties, ReactNode } from "react";
import { formatPrescription, type InstructorExercise, type InstructorMessage } from "@/lib/exerciseInstructor";

type ExerciseInstructorProps = {
  exercise: InstructorExercise;
  allowSpeech?: boolean;
} & (
  | { mode: "tutorial"; onReady: () => void; world?: WorldKind; demo?: DemoKind | null; backLink?: ReactNode; beforeSteps?: ReactNode; readyLabel?: string }
  | { mode: "session"; message: InstructorMessage }
);

function NovaAvatar() {
  return (
    <div aria-hidden="true" className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-200/30 bg-gradient-to-br from-cyan-300/20 via-indigo-400/30 to-violet-500/20 shadow-[0_0_35px_#818cf830]">
      <NovaMark size={52} />
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

  const theme = props.world ? THEMES[props.world] : null;
  const accent = theme?.accent ?? "#F2C14E";
  const ink = theme?.ink ?? "#2A2410";
  const dose = formatPrescription(exercise.prescription);
  const steps = [
    { title: "Find your starting position", text: exercise.positioning, detail: exercise.cameraRequirements },
    { title: "Bring the world to life", text: theme ? `${theme.goal}` : exercise.gameDescription },
    { title: "Start when you're ready", text: exercise.startInstruction },
  ];

  return (
    <section aria-labelledby="tutorial-title" className="relative isolate min-h-screen overflow-hidden text-[#F4F6F2]" style={{ "--rv-accent": accent } as CSSProperties}>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: theme?.skyDim ?? "linear-gradient(180deg,#1E2240,#34355E 55%,#6A5C7D)" }} />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-40" style={{ background: `radial-gradient(55% 45% at 72% 62%, ${accent}, transparent 70%)` }} />

      <div className="mx-auto grid min-h-screen max-w-6xl content-center gap-6 px-5 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          {props.backLink}
          <p className="mt-6 flex items-center gap-3 text-[16px]"><NovaMark size={34} /><span>Nova, your quest companion</span></p>
          <h1 id="tutorial-title" className="mt-4 font-display text-[clamp(42px,6vw,78px)] font-extrabold leading-[.95] tracking-tight">{theme?.quest ?? "A little movement, a little magic"}</h1>
          <p className="mt-4 max-w-[46ch] text-[19px] leading-snug opacity-90">{theme?.goal ?? exercise.gameDescription}</p>

          <div className="mt-8 rounded-3xl border border-white/20 bg-[rgba(24,28,54,.72)] p-6 backdrop-blur-md">
            <p className="text-[15px] opacity-75">{exercise.targetLabel ?? "Your movement"}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{exercise.name}</h2>
            {dose && <p className="mt-1 text-[18px] font-semibold" style={{ color: accent }}>{dose}</p>}
            <ul className="mt-4 grid gap-2 text-[17px] leading-snug">
              {exercise.instructions.map((line) => (
                <li key={line} className="flex gap-3"><span aria-hidden style={{ color: accent }}>•</span><span className="opacity-90">{line}</span></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col rounded-[28px] border border-white/20 bg-[rgba(24,28,54,.82)] p-7 backdrop-blur-md">
          {props.demo && (
            <div className="grid place-items-center rounded-2xl bg-black/20 py-4">
              <DemoFigure demo={props.demo} accent={accent} size={150} />
              <p className="mt-1 text-[15px] opacity-70">How the movement looks</p>
            </div>
          )}
          {props.beforeSteps}
          <ol className="mt-6 grid gap-4 text-[17px] leading-snug">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display font-bold" style={{ background: accent, color: ink }}>{i + 1}</span>
                <div>
                  <b className="font-display">{step.title}.</b> <span className="opacity-85">{step.text}</span>
                  {step.detail && <span className="mt-1 block text-[15px] opacity-70">{step.detail}</span>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 text-[15px] leading-snug">{exercise.safetyMessage}</p>
          <div className="mt-4"><NovaVoiceControl /></div>
          <button type="button" onClick={props.onReady} className="rv-btn rv-btn-big mt-6 w-full border-0" style={{ background: accent, color: ink }}>
            {props.readyLabel ?? "I'm Ready"} <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-center text-[15px] opacity-70">{exercise.nextStepMessage ?? "Next: enable your camera and get into position."}</p>
        </div>
      </div>
    </section>
  );
}
