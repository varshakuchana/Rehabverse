"use client";
import { useEffect, useState } from "react";
import TrackedQuest from "@/components/TrackedQuest";
import IslandPresentation from "@/components/IslandPresentation";
import NovaVoiceControl from "@/components/NovaVoiceControl";
import { storyQuest, storyLines, abilities } from "@/data/storyCampaign";
import { advanceSequence, initialSequence, resetSequence } from "@/lib/storyProgress";
import { saveStoryCompletion } from "@/lib/storyStorage";
import type { StoryProgress, StoryRealm } from "@/types/story";
import StoryWorld, { DormantIsland, realmRestoration } from "./StoryWorld";

export default function StorySession({ realm, progress, onExit, onSaved }: { realm: StoryRealm; progress: StoryProgress; onExit: () => void; onSaved: (progress: StoryProgress) => void }) {
  const [sequence, setSequence] = useState(initialSequence);
  const [stageDone, setStageDone] = useState(false);
  const [complete, setComplete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const stage = realm.stages[sequence.stage];
  useEffect(() => {
    document.getElementById("main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [sequence.stage, sequence.resets, complete]);
  function persist() {
    try { onSaved(saveStoryCompletion(realm.id)); setSaved(true); setSaveError(""); }
    catch { setSaveError("The realm is restored, but Story progress could not be saved on this device. Retry before leaving."); }
  }
  function stageComplete() {
    if (sequence.stage === realm.stages.length - 1) {
      setSequence(state => advanceSequence(state, realm, stage.ability));
      setComplete(true);
      persist();
    } else setStageDone(true);
  }
  function nextStage() {
    if (!stageDone) return;
    setSequence(state => advanceSequence(state, realm, stage.ability));
    setStageDone(false);
    setConnectionMessage("");
  }
  function trackingLost() {
    if (!realm.sequence) return;
    setSequence(state => resetSequence(state, realm));
    setStageDone(false);
    setConnectionMessage(storyLines.lost);
  }
  if (complete) {
    const finale = realm.id === "motion-core";
    const zones = realmRestoration(progress);
    zones[realm.zone] = 1;
    if (finale) zones.fill(1);
    return <main id="main-content" tabIndex={-1} className="story-shell story-victory">
      <div className="story-victory-world"><IslandPresentation completedReps={1} targetReps={1} focus={realm.zone} zoneProgress={zones} ability={stage.ability} finale={finale} celebrated><DormantIsland fraction={1} /></IslandPresentation></div>
      <div className="story-victory-panel rv-glass">
        <p className="story-kicker">{finale ? "Campaign Complete" : "Realm restored"}</p>
        <h1>{finale ? "MOTION CORE RESTORED" : `${realm.name} Restored`}</h1>
        <p>{finale ? storyLines.complete : storyLines.restored}</p>
        {!finale && <><p className="story-reward">✦ {realm.fragment}</p><p>Ability unlocked: {realm.reward && abilities[realm.reward].name}</p><p>The next realm is now available.</p></>}
        <NovaVoiceControl message={{ id: finale ? "story-complete" : "story-restored", text: finale ? storyLines.complete : storyLines.restored }} allowed />
        <p role="status">{saved ? "Story progress saved on this device. HEP and Explore history are unchanged." : saveError}</p>
        {saveError && <button className="rv-btn" onClick={persist}>Retry saving</button>}
        <button className="rv-btn rv-btn-primary" disabled={!saved} onClick={onExit}>Return to World Map</button>
        {!saved && <button className="story-text-button" onClick={() => { if (window.confirm("Leave without saving this realm? You will need to replay it to unlock the next realm.")) onExit(); }}>Leave without saving</button>}
      </div>
    </main>;
  }
  return <div className="story-session">
    {connectionMessage && <p role="status" className="story-reset-notice">{connectionMessage} Your completed patterns are kept. Review your position, then start again.</p>}
    <TrackedQuest key={`${realm.id}:${sequence.stage}:${sequence.resets}`} definition={storyQuest(realm, sequence.stage)} presentation={{ mode: "story", onComplete: stageComplete, onTrackingLost: trackingLost, onExit,
      renderWorld: visual => <StoryWorld realm={realm} sequence={sequence} progress={progress} visual={visual} stageDone={stageDone} connectionMessage={connectionMessage} onContinue={nextStage} />,
    }} />
  </div>;
}
