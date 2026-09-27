"use client";
import Link from "next/link";
import { useReducer, useRef, useState } from "react";
import type { QuestDefinition } from "@/types/quest";
import type { CompletedSession } from "@/types/progress";
import { guidedQuestReducer, initialGuidedState } from "@/lib/guidedQuest";
import { localDateKey, saveCompletedSession } from "@/lib/progressStorage";
import ExerciseInstructor from "./ExerciseInstructor";
import RehabWorldGame from "./RehabWorldGame";

export default function GuidedQuest({ definition, onContinue }: { definition: QuestDefinition; onContinue?: () => void }) {
  const [session, dispatch] = useReducer(guidedQuestReducer, initialGuidedState);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const recordRef = useRef<CompletedSession | null>(null);
  const { instructor, target } = definition;
  const score = session.reps * 100;
  const complete = session.phase === "complete";

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
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex flex-wrap justify-between gap-4 text-sm text-slate-300"><Link href={definition.source === "hep" ? "/quest" : "/explore"}>← {definition.source === "hep" ? "My HEP" : "Explore"}</Link><div className="flex gap-5"><Link href="/">Home</Link><Link href="/progress">My Progress →</Link></div></nav>
        {session.phase === "tutorial" ? <ExerciseInstructor mode="tutorial" exercise={instructor} onReady={() => dispatch({ type: "ready" })} /> : <>
          <header className="mb-7"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{definition.source === "hep" ? "My HEP · Confirmed instructions" : "Explore · General movement"}</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{instructor.name}</h1><p className="mt-4 w-fit rounded-full border border-violet-300/30 bg-violet-300/10 px-4 py-2 text-sm text-violet-100">Guided Mode — completion is controlled by you</p><p className="mt-3 text-sm text-slate-400">No camera or microphone is active. Repetitions and form are not verified.</p></header>
          <ExerciseInstructor mode="session" allowSpeech={session.phase === "active" || complete} exercise={instructor} message={{ id: session.phase, text: message }} />
          <section className="mb-6 rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-slate-300">{instructor.targetLabel}</p>{definition.holdSeconds && <p className="mt-2 text-sm text-indigo-200">Follow your prescribed {definition.holdSeconds}-second hold for each repetition. Mark only after completing it; hold timing is self-reported.</p>}<p className="mt-2 text-4xl font-bold" aria-live="polite">{session.reps}<span className="text-xl text-slate-400"> / {target} marked movements</span></p></div><p className="text-sm text-cyan-200">{score} game points · 100 per marked movement</p></div>
            <div className="mt-5 flex flex-wrap gap-3">
              {session.phase === "ready" && <button onClick={() => dispatch({ type: "start", id: crypto.randomUUID() })} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400">Start</button>}
              {session.phase === "active" && <>
                {session.reps < target ? <button onClick={() => dispatch({ type: "mark", target })} className="rounded-xl bg-cyan-300 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-200">Mark one movement +</button> : <button onClick={finish} className="rounded-xl bg-cyan-300 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-200">Complete Quest</button>}
                <button onClick={() => dispatch({ type: "pause" })} className="rounded-xl border border-white/20 px-5 py-3">Pause</button>
              </>}
              {session.phase === "paused" && <button onClick={() => dispatch({ type: "resume" })} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold">Resume</button>}
              {complete && <>{onContinue && <button onClick={onContinue} disabled={saveFailed || !saveMessage} className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40">Continue quest →</button>}<button onClick={playAgain} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold">Play Again</button><Link href="/progress" className="rounded-xl border border-cyan-300/30 px-5 py-3 text-cyan-100">View Progress →</Link></>}
            </div>
            {complete && <div className="mt-4"><p role="status" className="text-sm text-slate-300">{saveMessage}</p>{saveFailed && <button onClick={saveRecord} className="mt-3 rounded-lg border border-white/20 px-4 py-2">Retry saving</button>}</div>}
          </section>
          <RehabWorldGame sessionState={complete ? "complete" : session.phase === "active" ? "active" : "ready"} completedReps={session.reps} targetReps={target} movementProgress="ready" completionMode="manual" />
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Your movement guide</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">{instructor.instructions.map(text => <li key={text}>{text}</li>)}</ul><p className="mt-4 text-xs leading-6 text-slate-400">{instructor.safetyMessage}</p><Link href={definition.source === "hep" ? "/quest" : "/explore"} className="mt-4 inline-block text-sm text-cyan-200">Leave quest →</Link></section>
        </>}
      </div>
    </main>
  );
}
