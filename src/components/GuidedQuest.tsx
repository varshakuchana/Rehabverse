"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import type { QuestDefinition } from "@/types/quest";
import type { CompletedSession } from "@/types/progress";
import { guidedQuestReducer, initialGuidedState } from "@/lib/guidedQuest";
import { localDateKey, saveCompletedSession } from "@/lib/progressStorage";
import ExerciseInstructor from "./ExerciseInstructor";
import RehabWorldGame from "./RehabWorldGame";
import ExerciseWorld from "./ExerciseWorld";
import NovaVoiceControl from "./NovaVoiceControl";
import { Stage, StageActions, StageCenter, StageCoach, StageCounter, StagePanel, StagePrimary, StageTopBar, stageBtn } from "./stage/Stage";
import { THEMES, demoFor, worldFor } from "@/lib/worldTheme";

export default function GuidedQuest({ definition, onContinue }: { definition: QuestDefinition; onContinue?: () => void }) {
  const [session, dispatch] = useReducer(guidedQuestReducer, initialGuidedState);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const recordRef = useRef<CompletedSession | null>(null);
  const { instructor, target } = definition;
  const score = session.reps * 100;
  const complete = session.phase === "complete";
  const [pulse, setPulse] = useState(0);
  function mark() {
    dispatch({ type: "mark", target });
    setPulse((n) => n + 1);
  }

  function saveRecord() {
    if (!recordRef.current) return;
    try {
      saveCompletedSession(recordRef.current);
      setSaveMessage(`Saved to Progress as self-reported ${definition.source === "hep" ? "HEP" : "Explore"} activity.`);
      setSaveFailed(false);
    } catch {
      setSaveMessage("Your quest is complete, but browser storage could not save it. Retry before leaving or playing again.");
      setSaveFailed(true);
    }
  }
  function finish() {
    if (session.phase !== "active" || session.reps !== target || !session.sessionId) return;
    if (!recordRef.current) {
      const now = new Date();
      recordRef.current = {
        id: session.sessionId, exerciseId: definition.exerciseId, exerciseName: instructor.name,
        completedAt: now.toISOString(), completedLocalDate: localDateKey(now),
        completedReps: session.reps, targetReps: target, status: "complete", score,
        source: definition.source, planId: definition.planId, prescribedSets: definition.prescribedSets, completionMethod: "self-reported",
      };
    }
    dispatch({ type: "complete", target });
    saveRecord();
  }
  function playAgain() {
    recordRef.current = null;
    setSaveMessage(""); setSaveFailed(false);
    dispatch({ type: "reset" });
  }
  const message = complete ? instructor.completionMessage : session.phase === "paused"
    ? "Take a moment. Your marked movements are kept for this quest; resume whenever you're ready."
    : session.phase === "ready" ? "This is your own movement moment. Press Start when you're ready; I'll keep you company."
    : session.reps === target ? "You've marked every movement. Choose Complete Quest when you're ready to save your activity."
    : instructor.activeMessage;
  const world = worldFor(definition);
  const theme = THEMES[world];
  const backHref = definition.source === "hep" ? "/quest" : "/explore";
  const backLabel = definition.source === "hep" ? "My quest" : "Explore";
  const active = session.phase === "active";

  // Space bar marks a movement too, handy when you're away from the mouse.
  const markRef = useRef(() => {});
  useEffect(() => {
    markRef.current = () => { if (session.phase === "active" && session.reps < target) mark(); };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement | null)?.closest?.("button, a, input, textarea, select")) return;
      e.preventDefault();
      markRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.phase === "tutorial") {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#161A30] text-[#F4F6F2]">
        <ExerciseInstructor mode="tutorial" exercise={instructor} onReady={() => dispatch({ type: "ready" })}
          world={world} demo={demoFor(definition)}
          backLink={<Link href={backHref} className="rounded-full bg-[rgba(24,28,54,.55)] px-4 py-2 text-[15px] backdrop-blur-md transition hover:bg-[rgba(24,28,54,.85)]"><span aria-hidden>←</span> Back to {backLabel}</Link>} />
      </main>
    );
  }

  const coach = complete ? { title: theme.done, hint: "Saved as self-reported. Take a breath." }
    : session.phase === "paused" ? { title: "Paused", hint: "Your marked movements are kept. Resume whenever you're ready." }
    : session.phase === "ready" ? { title: "Ready when you are", hint: "Press Start, then mark each movement after you finish it." }
    : session.reps === target ? { title: "All marked", hint: "Choose Complete quest when you're ready to save it." }
    : { title: "At your own pace", hint: definition.holdSeconds ? `Hold for ${definition.holdSeconds} seconds as your plan says, then mark it.` : "Finish a movement, then mark it. Space works too." };

  return (
    <Stage accent={theme.accent} label={`${instructor.name} guided session`}
      world={<ExerciseWorld key={`${world}:${target}`} world={world} completed={session.reps} target={target} active={active} pulseKey={pulse}
        fallback={<RehabWorldGame sessionState={complete ? "complete" : active ? "active" : "ready"} completedReps={session.reps} targetReps={target} movementProgress="ready" completionMode="manual" />} />}>
      <StageTopBar backHref={backHref} backLabel={backLabel}
        context={`Guided mode: you mark each movement, nothing is measured. ${score} points.`} />

      <StageCoach eyebrow={instructor.name} quest={theme.quest} title={coach.title} hint={coach.hint} accent={theme.accent}
        demo={complete ? null : demoFor(definition)}
        note={definition.source === "hep" ? "From your PT's plan." : instructor.targetLabel}
        nova={<><p role="status" aria-atomic="true" className="text-[15px] leading-snug opacity-90">{message}</p><div className="mt-2"><NovaVoiceControl compact message={{ id: session.phase, text: message }} allowed={active || complete} /></div></>} />

      {session.phase === "ready" && (
        <StageCenter>
          <StagePrimary big onClick={() => dispatch({ type: "start", id: crypto.randomUUID() })} accent={theme.accent} ink={theme.ink}>Start</StagePrimary>
        </StageCenter>
      )}

      <StageCounter value={session.reps} target={target} unit={theme.unit} />

      <StageActions>
        {active && <>
          <button type="button" onClick={() => dispatch({ type: "pause" })} className={stageBtn}>Pause</button>
          {session.reps < target
            ? <StagePrimary big onClick={mark} accent={theme.accent} ink={theme.ink}>Mark one movement</StagePrimary>
            : <StagePrimary big onClick={finish} accent={theme.accent} ink={theme.ink}>Complete quest</StagePrimary>}
        </>}
        {session.phase === "paused" && <StagePrimary big onClick={() => dispatch({ type: "resume" })} accent={theme.accent} ink={theme.ink}>Resume</StagePrimary>}
      </StageActions>

      {complete && (
        <StagePanel>
          <p className="text-[15px]" style={{ color: theme.accent }}>{theme.quest}</p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Quest complete</h2>
          <p className="mt-2 text-[18px] opacity-90">You marked {target} {target === 1 ? "movement" : "movements"} of {instructor.name}.</p>
          <p role="status" className="mt-4 text-[15px] opacity-85">{saveMessage}</p>
          {saveFailed && <button type="button" onClick={saveRecord} className="rv-link mt-1 text-[15px]">Retry saving</button>}
          <div className="mt-6 flex flex-wrap gap-3">
            {onContinue && <StagePrimary onClick={onContinue} disabled={saveFailed || !saveMessage} accent={theme.accent} ink={theme.ink}>Continue quest →</StagePrimary>}
            <button type="button" onClick={playAgain} className={onContinue ? "rv-btn rv-btn-ghost" : "rv-btn border-0"} style={onContinue ? undefined : { background: theme.accent, color: theme.ink }}>Play again</button>
            <Link href="/progress" className="rv-btn rv-btn-ghost">Progress</Link>
            <Link href={backHref} className="rv-btn rv-btn-ghost">{backLabel}</Link>
          </div>
          <details className="mt-5 text-[15px]"><summary className="opacity-80">Your movement guide</summary><ul className="mt-2 grid gap-1.5 opacity-85">{instructor.instructions.map(text => <li key={text}>{text}</li>)}</ul></details>
          <p className="mt-4 text-[14px] opacity-65">{instructor.safetyMessage}</p>
        </StagePanel>
      )}
    </Stage>
  );
}
