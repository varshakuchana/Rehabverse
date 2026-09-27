"use client";

import { useEffect, useState } from "react";
import { NovaMark } from "@/components/NovaMark";
import NovaVoiceControl from "@/components/NovaVoiceControl";
import { storyLines } from "@/data/storyCampaign";

/* The prologue as a short cinematic: one line at a time over the dormant island. */
const LINES = storyLines.prologue.split(/(?<=\.)\s+/);

export default function StoryPrologue({ onBegin }: { onBegin: () => void }) {
  const [i, setI] = useState(0);
  const last = i >= LINES.length - 1;
  useEffect(() => {
    if (last || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setI(n => n + 1), 3200);
    return () => window.clearTimeout(t);
  }, [i, last]);

  return (
    <div className="story-prologue-copy">
      <NovaMark size={52} />
      <h2 id="prologue-heading" className="sr-only">Prologue</h2>
      <p aria-live="polite" key={i} className="story-prologue-line">{LINES[i]}</p>
      <ol className="story-prologue-dots" aria-hidden>
        {LINES.map((_, n) => <li key={n} data-on={n <= i} />)}
      </ol>
      <div className="story-actions">
        {last
          ? <button className="rv-btn rv-btn-primary rv-btn-big" onClick={onBegin}>Begin the journey</button>
          : <button className="rv-btn rv-btn-ghost" onClick={() => setI(n => n + 1)}>Next</button>}
        {!last && <button className="story-text-button" onClick={onBegin}>Skip</button>}
      </div>
      <div className="mt-4 flex justify-center"><NovaVoiceControl compact message={{ id: "story-prologue", text: storyLines.prologue }} allowed /></div>
    </div>
  );
}
