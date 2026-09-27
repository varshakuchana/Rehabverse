"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";
import IslandPresentation from "@/components/IslandPresentation";
import NovaVoiceControl from "@/components/NovaVoiceControl";
import { NovaMark } from "@/components/NovaMark";
import { storyRealms, storyLines } from "@/data/storyCampaign";
import { beginStory, enterStoryRealm, readStory, resetStory, STORY_STORAGE_KEY } from "@/lib/storyStorage";
import type { RealmId, StoryProgress } from "@/types/story";
import StorySession from "./StorySession";
import { DormantIsland, realmRestoration } from "./StoryWorld";

export default function StoryCampaign() {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RealmId>("sleeping-grove");
  const [active, setActive] = useState<RealmId | null>(null);
  useEffect(() => {
    function refresh() {
      try { const state = readStory(); setProgress(state); setSelected(state.currentRealm ?? "sleeping-grove"); setError(""); }
      catch { setError("Story storage is unavailable or could not be read. Enable browser storage and retry, or reset only Story Progress."); }
    }
    queueMicrotask(refresh);
    const sync = (event: StorageEvent) => { if (event.key === STORY_STORAGE_KEY || event.key === null) { setActive(null); refresh(); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [active]);
  function reset() {
    if (!window.confirm("Reset all Shattered Realms progress? This clears Story fragments and unlocks only. My HEP, Explore and their history are kept.")) return;
    try { setProgress(resetStory()); setSelected("sleeping-grove"); setActive(null); setError(""); }
    catch { setError("Story progress could not be reset. Check browser storage access and try again."); }
  }
  function begin() {
    try { setProgress(beginStory()); setError(""); }
    catch { setError("Your journey could not be saved. Enable browser storage and try again."); }
  }
  const realm = storyRealms.find(r => r.id === selected)!;
  if (active && progress) return <StorySession realm={storyRealms.find(r => r.id === active)!} progress={progress} onSaved={setProgress} onExit={() => setActive(null)} />;
  const zones = progress ? realmRestoration(progress) : [0, 0, 0, 0, 0];
  return <main id="main-content" tabIndex={-1} className="story-shell">
    <div className="story-content"><SiteNav current="story" />
      <header className="story-title"><p className="story-kicker">RehabVerse presents</p><h1>The Shattered Realms</h1><p>Enter the Shattered Realms and restore a world powered by your movement.</p><small>General movement game — not personalized medical treatment.</small></header>
      {error && <div role="alert" className="story-error"><p>{error}</p><button className="rv-btn" onClick={() => { try { setProgress(readStory()); setError(""); } catch { setError("Story storage is still unavailable. Check your browser settings."); } }}>Retry storage</button></div>}
      {!progress && !error && <p role="status">Opening your world…</p>}
      {progress && !progress.prologueSeen ? <section className="story-prologue" aria-labelledby="prologue-heading">
        <IslandPresentation backdrop zoneProgress={[0, 0, 0, 0, 0]}><DormantIsland /></IslandPresentation>
        <div className="story-prologue-copy rv-glass"><NovaMark size={48} /><p className="story-kicker">Prologue · The Fall</p><h2 id="prologue-heading">The world is waiting.</h2><p>This world once moved with us.</p><p>Then The Stillness shattered the Motion Core.</p><p>Three fragments remain.</p><p>If the world responds to you… we may still be able to restore it.</p><NovaVoiceControl message={{ id: "story-prologue", text: storyLines.prologue }} allowed /><div className="story-actions"><button className="rv-btn rv-btn-primary" onClick={begin}>Begin Journey</button><button className="rv-btn" onClick={begin}>Skip</button></div></div>
      </section> : progress && <>
        <section className="story-map" aria-label="Map of the Shattered Realms">
          <IslandPresentation focus={realm.zone} zoneProgress={zones}><DormantIsland fraction={progress.completedLevels.length / 4} /></IslandPresentation>
          <svg className="story-map-path" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><path d="M180 360Q300 130 430 200T720 300Q700 460 510 460" fill="none" stroke="#F2C14E" strokeOpacity=".5" strokeWidth="2" strokeDasharray="5 10" /></svg>
          <ol className="story-map-locations">
            {storyRealms.map((location, index) => {
              const unlocked = progress.unlockedRealms.includes(location.id);
              const restored = progress.completedLevels.includes(location.levelId);
              return <li key={location.id} className={`story-location story-location-${index}`}><button aria-pressed={selected === location.id} disabled={!unlocked} onClick={() => setSelected(location.id)}>
                <span className="story-location-orb" aria-hidden="true">{restored ? "✦" : unlocked ? "◇" : "⌑"}</span><strong>{location.name}</strong><small>{restored ? "Restored" : unlocked ? "Available" : "Locked"}</small>
              </button></li>;
            })}
          </ol>
          <p className="story-map-caption">{progress.storyCompleted ? "All realms restored · The Motion Core shines again" : `${progress.collectedFragments.length} / 3 Motion Fragments collected`}</p>
        </section>
        <section className="story-realm-dock rv-glass" aria-labelledby="selected-realm"><div><p className="story-kicker">{realm.subtitle}</p><h2 id="selected-realm">{realm.name}</h2><p>{realm.introduction}</p><p className="story-muted">{realm.sequence ? "Two visible patterns · no timer" : `${realm.stages.length} ${realm.stages.length === 1 ? "objective" : "objectives"}`} · One comfortable movement, one action.</p><NovaVoiceControl message={{ id: realm.id, text: realm.introduction }} allowed /></div><button className="rv-btn rv-btn-primary" onClick={() => {
          try { setProgress(enterStoryRealm(realm.id)); setActive(realm.id); setError(""); }
          catch { setError("Could not enter this realm. Check Story storage and retry."); }
        }}>{progress.completedLevels.includes(realm.levelId) ? "Revisit realm" : "Enter realm"} →</button></section>
        <section className="story-inventory" aria-label="Motion Fragments"><h2>Fragments of a world</h2><ul>{["Grove Fragment", "Crystal Fragment", "Sky Fragment"].map(fragment => <li key={fragment}><span aria-hidden="true">{progress.collectedFragments.includes(fragment) ? "◆" : "◇"}</span> {fragment} · {progress.collectedFragments.includes(fragment) ? "Collected" : "Not yet found"}</li>)}</ul></section>
      </>}
      <footer className="story-footer"><p>Move comfortably. Stop if you experience discomfort. Follow existing care-plan limits. For your professional exercise plan, visit <Link href="/hep">My HEP</Link>.</p><p>Story saves on this device only. Camera tracking is required; your camera stays off until you enable it in a realm. Completed realms are saved; unfinished stages restart when you leave.</p><button className="story-text-button" onClick={reset}>Reset Story Progress</button></footer>
    </div>
  </main>;
}
