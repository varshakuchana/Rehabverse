"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TrackedQuest from "@/components/TrackedQuest";
import IslandPresentation from "@/components/IslandPresentation";
import NovaVoiceControl from "@/components/NovaVoiceControl";
import { abilities, storyLines, storyQuest, storyRealms } from "@/data/storyCampaign";
import { advanceSequence, initialSequence, resetSequence } from "@/lib/storyProgress";
import { enterStoryRealm, saveStoryCompletion } from "@/lib/storyStorage";
import type { TrackedSide } from "@/lib/movementDetectors";
import type { StoryProgress } from "@/types/story";
import StoryWorld, { DormantIsland, FRAGMENT_COLORS, realmRestoration, type StoryToast } from "./StoryWorld";
import { FragmentGem } from "./StoryArt";
import Cutebot from "./Cutebot";

/*
  Story Mode as one continuous game. Realms and stages chain together:
  finish a stage -> short "Connected!" -> the next stage starts itself;
  finish a realm -> it is saved -> short celebration -> the next realm begins.
  The shared tracker still owns detection, counting and the countdown; the
  player says "Start" once at the beginning, and every later stage starts its
  own countdown when they are back in view. A failed save pauses the game.
*/
const firstOpenRealm = (p: StoryProgress) => {
  const i = storyRealms.findIndex(r => !p.completedLevels.includes(r.levelId));
  return i < 0 ? 0 : i;
};
const shortName = (name: string) => name.replace(/^The /, "");

export default function StoryGame({ progress, onSaved, onExit, side }: {
  progress: StoryProgress; onSaved: (p: StoryProgress) => void; onExit: () => void; side: TrackedSide;
}) {
  const [startIndex] = useState(() => firstOpenRealm(progress));
  const [realmIndex, setRealmIndex] = useState(startIndex);
  const [sequence, setSequence] = useState(initialSequence);
  const [toast, setToast] = useState<StoryToast>(null);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [finished, setFinished] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  const realm = storyRealms[realmIndex];
  const stage = realm.stages[sequence.stage];
  // Only the very first stage of this run waits for "Start"; everything after starts itself.
  const firstStage = realmIndex === startIndex && sequence.stage === 0 && sequence.resets === 0;

  function stageComplete() {
    if (sequence.stage < realm.stages.length - 1) {
      setToast({ kind: "stage", title: "Connected!", next: realm.stages[sequence.stage + 1].ability });
      later(2200, () => {
        setSequence(state => advanceSequence(state, realm, stage.ability));
        setToast(null);
        setConnectionMessage("");
      });
    } else saveRealm();
  }

  function saveRealm() {
    try {
      onSaved(saveStoryCompletion(realm.id));
      setSaveError("");
    } catch {
      setSaveError("This realm is restored, but it couldn't be saved on this device. Retry so the next realm unlocks.");
      return;
    }
    const finale = realm.id === "motion-core";
    setToast({
      kind: "realm",
      title: finale ? "The Motion Core is whole!" : `${shortName(realm.name)} restored!`,
      sub: realm.reward ? `New ability: ${abilities[realm.reward].name}` : undefined,
      gemColor: realm.fragment ? FRAGMENT_COLORS[realm.fragment] : "#F2C14E",
    });
    later(3200, () => {
      setToast(null);
      setConnectionMessage("");
      if (finale) { setFinished(true); return; }
      const next = storyRealms[realmIndex + 1];
      try { onSaved(enterStoryRealm(next.id)); } catch { /* entering only records the current realm */ }
      setRealmIndex(i => i + 1);
      setSequence(initialSequence());
    });
  }

  function trackingLost() {
    if (!realm.sequence || toast) return;
    setSequence(state => resetSequence(state, realm));
    setConnectionMessage(storyLines.lost);
  }

  function playAgain() {
    try { onSaved(enterStoryRealm(storyRealms[0].id)); } catch { /* replay is allowed from the start */ }
    setFinished(false);
    setRealmIndex(0);
    setSequence(initialSequence());
  }

  if (finished) {
    return <main id="main-content" tabIndex={-1} className="story-shell story-victory">
      <div className="story-victory-world"><IslandPresentation completedReps={1} targetReps={1} focus={null} zoneProgress={realmRestoration(progress).map(() => 1)} ability="lumen-rise" finale celebrated><DormantIsland fraction={1} /></IslandPresentation></div>
      <div className="story-victory-panel rv-glass">
        <div className="flex justify-center"><Cutebot pose="cheer" accent="#F2C14E" size={120} /></div>
        <div className="flex justify-center gap-3"><FragmentGem lit color="#91D5A0" /><FragmentGem lit color="#B69CFF" size={80} /><FragmentGem lit color="#8FD8F0" /></div>
        <h1>You rebuilt the world</h1>
        <p className="story-victory-line">{storyLines.complete}</p>
        <div className="story-actions justify-center">
          <button autoFocus className="rv-btn rv-btn-primary rv-btn-big" onClick={playAgain}>Play again</button>
          <Link href="/" className="rv-btn rv-btn-ghost">Home</Link>
          <NovaVoiceControl compact message={{ id: "story-complete", text: storyLines.complete }} allowed />
        </div>
      </div>
    </main>;
  }

  return <div className="story-session">
    <TrackedQuest
      key={`${realm.id}:${sequence.stage}:${sequence.resets}`}
      definition={{ ...storyQuest(realm, sequence.stage), trackedSide: side }}
      presentation={{
        mode: "story", onComplete: stageComplete, onTrackingLost: trackingLost, onExit,
        skipIntro: true, autoCamera: true, autoStart: !firstStage,
        renderWorld: visual => <StoryWorld realm={realm} realmIndex={realmIndex} sequence={sequence} progress={progress} visual={visual} toast={toast} connectionMessage={connectionMessage} autoStart={!firstStage} />,
      }}
    />
    {saveError && (
      <div role="alertdialog" aria-labelledby="save-h" className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,12,28,.6)] p-4">
        <div className="rv-glass max-w-md rounded-[28px] p-7 text-center">
          <div className="flex justify-center"><Cutebot pose="look" accent="#F2C14E" size={90} /></div>
          <h2 id="save-h" className="mt-2 font-display text-2xl font-bold">Couldn&apos;t save</h2>
          <p className="mt-2 opacity-90">{saveError}</p>
          <div className="story-actions justify-center">
            <button autoFocus className="rv-btn rv-btn-primary" onClick={saveRealm}>Retry saving</button>
            <button className="story-text-button" onClick={() => { if (window.confirm("Leave without saving this realm? You'll need to replay it to unlock the next one.")) onExit(); }}>Leave without saving</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
