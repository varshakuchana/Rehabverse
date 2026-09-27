"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";
import IslandPresentation from "@/components/IslandPresentation";
import { storyRealms } from "@/data/storyCampaign";
import { beginStory, enterStoryRealm, readStory, resetStory, STORY_STORAGE_KEY } from "@/lib/storyStorage";
import type { StoryProgress } from "@/types/story";
import type { TrackedSide } from "@/lib/movementDetectors";
import StoryGame from "./StoryGame";
import StoryPrologue from "./StoryPrologue";
import { AbilityOrb, FragmentGem } from "./StoryArt";
import Cutebot from "./Cutebot";
import { DormantIsland, FRAGMENT_COLORS, realmRestoration } from "./StoryWorld";

export default function StoryCampaign() {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [side, setSide] = useState<TrackedSide>("left");
  useEffect(() => {
    function refresh() {
      try { setProgress(readStory()); setError(""); }
      catch { setError("Story storage is unavailable or could not be read. Enable browser storage and retry, or reset only Story Progress."); }
    }
    queueMicrotask(refresh);
    const sync = (event: StorageEvent) => { if (event.key === STORY_STORAGE_KEY || event.key === null) { setPlaying(false); refresh(); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [playing]);

  function reset() {
    if (!window.confirm("Reset all Shattered Realms progress? This clears Story fragments and unlocks only. My HEP, Explore and their history are kept.")) return;
    try { setProgress(resetStory()); setPlaying(false); setError(""); }
    catch { setError("Story progress could not be reset. Check browser storage access and try again."); }
  }
  function begin() {
    try { setProgress(beginStory()); setError(""); }
    catch { setError("Your journey could not be saved. Enable browser storage and try again."); }
  }
  function play() {
    if (!progress) return;
    const open = storyRealms.find(r => !progress.completedLevels.includes(r.levelId)) ?? storyRealms[0];
    try { setProgress(enterStoryRealm(open.id)); setPlaying(true); setError(""); }
    catch { setError("Could not start the game. Check Story storage and retry."); }
  }

  if (playing && progress) return <StoryGame progress={progress} onSaved={setProgress} onExit={() => setPlaying(false)} side={side} />;

  const zones = progress ? realmRestoration(progress) : [0, 0, 0, 0, 0];
  const done = progress?.completedLevels.length ?? 0;
  const started = done > 0;
  return <main id="main-content" tabIndex={-1} className="story-shell">
    <div className="story-content"><SiteNav current="story" />
      {error && <div role="alert" className="story-error"><p>{error}</p><button className="rv-btn" onClick={() => { try { setProgress(readStory()); setError(""); } catch { setError("Story storage is still unavailable. Check your browser settings."); } }}>Retry storage</button></div>}
      {!progress && !error && <p role="status">Opening your world…</p>}

      {progress && !progress.prologueSeen ? <section className="story-prologue" aria-labelledby="prologue-heading">
        <IslandPresentation backdrop zoneProgress={[0, 0, 0, 0, 0]}><DormantIsland /></IslandPresentation>
        <h1 className="story-prologue-title">The Shattered Realms</h1><StoryPrologue onBegin={begin} />
      </section> : progress && (
        <section className="story-title-card" aria-labelledby="story-title">
          <IslandPresentation focus={null} zoneProgress={zones}><DormantIsland fraction={done / 4} /></IslandPresentation>
          <div className="story-title-overlay">
            <h1 id="story-title">The Shattered Realms</h1>
            <ol className="story-title-realms" aria-label="Your journey">
              {storyRealms.map(r => {
                const got = progress.completedLevels.includes(r.levelId);
                return <li key={r.id} data-got={got}>
                  {r.fragment ? <FragmentGem lit={got} size={30} color={FRAGMENT_COLORS[r.fragment]} /> : <AbilityOrb id="lumen-rise" size={28} lit={progress.storyCompleted} />}
                  <span>{r.name.replace(/^The /, "")}</span><span className="sr-only">{got ? ", restored" : ""}</span>
                </li>;
              })}
            </ol>

            <div className="story-title-play">
              <div className="story-title-bot"><Cutebot pose="wave" accent="#F2C14E" size={110} /></div>
              <div>
                <p className="story-title-say">{progress.storyCompleted ? "Want to play it all again?" : started ? "Ready to keep going?" : "One game, four realms."}</p>
                <p className="story-title-hint">I&apos;ll show you each move. Just follow along, and step away anytime to pause.</p>
                <fieldset className="story-arm">
                  <legend>For arm moves, use my</legend>
                  {(["left", "right"] as const).map(s => (
                    <label key={s}><input type="radio" name="story-arm" className="peer sr-only" checked={side === s} onChange={() => setSide(s)} /><span>{s} arm</span></label>
                  ))}
                </fieldset>
                <button autoFocus className="rv-btn rv-btn-primary rv-btn-big" onClick={play}>{progress.storyCompleted ? "Play again" : started ? "Continue" : "Play"}</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="story-footer"><p>General movement game, not medical treatment. Move comfortably and stop if anything hurts.</p><details><summary>Safety and saving</summary><p>Move comfortably. Stop if you experience discomfort. Follow existing care-plan limits. For your professional exercise plan, visit <Link href="/hep">My HEP</Link>.</p><p>Story saves on this device only. Camera tracking is required; the camera turns on when you press Play. Each restored realm is saved as you go; an unfinished realm restarts next time.</p><button className="story-text-button" onClick={reset}>Reset Story Progress</button></details></footer>
    </div>
  </main>;
}
