"use client";
import IslandPresentation from "@/components/IslandPresentation";
import type { SessionVisualState } from "@/types/sessionPresentation";
import type { StoryProgress, StoryRealm, StorySequence } from "@/types/story";
import { abilities, storyRealms } from "@/data/storyCampaign";

export function realmRestoration(progress: StoryProgress) {
  const zones = [0, 0, 0, 0, 0];
  for (const realm of storyRealms) if (progress.completedLevels.includes(realm.levelId)) zones[realm.zone] = 1;
  if (progress.storyCompleted) zones.fill(1);
  return zones;
}
export function DormantIsland({ fraction = 0 }: { fraction?: number }) {
  return <svg viewBox="0 0 1000 500" className="story-fallback" aria-hidden="true">
    <defs><radialGradient id="story-sky"><stop stopColor="#4c386d" /><stop offset="1" stopColor="#11162c" /></radialGradient></defs>
    <rect width="1000" height="500" fill="url(#story-sky)" />
    {Array.from({ length: 34 }, (_, i) => <circle key={i} cx={(i * 137) % 1000} cy={(i * 61) % 300} r="1.5" fill="#f4e8b4" />)}
    <path d="M120 295 410 215 880 290 720 385 505 465 285 382Z" fill="#27334b" />
    <ellipse cx="500" cy="290" rx="380" ry="92" fill="#344447" />
    <ellipse cx="500" cy="290" rx="380" ry="92" fill="#64926a" opacity={fraction} />
    {[250, 420, 620, 780].map((x, i) => <g key={x} transform={`translate(${x} ${260 + (i % 2) * 32})`}>
      <ellipse rx="60" ry="17" fill="#f2c14e" opacity={.1 + fraction * .35} />
      <path d="M0-85 24-45 0 0-24-45Z" fill={fraction > i / 4 ? "#f2d885" : "#74719b"} stroke="#d7ccff" />
    </g>)}
    <path d="M500 120 535 177 500 245 465 177Z" fill="#bba4ed" stroke="#ffe5a0" strokeWidth="3" />
  </svg>;
}
export default function StoryWorld({ realm, sequence, progress, visual, stageDone, connectionMessage, onContinue }: {
  realm: StoryRealm; sequence: StorySequence; progress: StoryProgress; visual: SessionVisualState;
  stageDone: boolean; connectionMessage: string; onContinue: () => void;
}) {
  const stage = realm.stages[sequence.stage];
  const ability = abilities[stage.ability];
  const zones = realmRestoration(progress);
  const fraction = (sequence.stage + visual.reps / visual.target) / realm.stages.length;
  zones[realm.zone] = Math.max(zones[realm.zone], fraction);
  if (realm.id === "sleeping-grove") zones[3] = fraction;
  const active = visual.sessionState === "active" || stageDone;
  return <section className={`story-world ${active ? "is-active" : ""}`} aria-label={`${realm.name} game world`} style={{ "--ability-color": ability.accent } as React.CSSProperties}>
    <IslandPresentation completedReps={visual.reps} targetReps={visual.target} channeling={visual.sessionState === "active" && visual.bodyDetected && (visual.movementPhase === "moving" || visual.movementPhase === "returning")} focus={realm.zone} zoneProgress={zones} ability={stage.ability} finale={realm.id === "motion-core"} landmarks={visual.landmarks} bodyReady={visual.bodyDetected}>
      <DormantIsland fraction={fraction} />
    </IslandPresentation>
    <div className="story-world-heading">
      <p className="story-kicker">{realm.subtitle}</p><h2>{realm.name}</h2>
      <p>{stage.objective}</p>
    </div>
    <div className="story-world-status" aria-live="polite">
      <span className="story-ability-symbol" aria-hidden="true">{ability.symbol}</span>
      <div><strong>{ability.name}</strong><p>{stageDone ? "Connection made" : `Crystal Energy ${visual.reps} / ${visual.target}`}</p><small>Movement: {ability.movement}</small></div>
    </div>
    {realm.sequence && <ol className="story-pattern" aria-label={`Pattern ${Math.floor(sequence.stage / 3) + 1} of 2. Complete at your own pace.`}>
      {(["lumen-rise", "aether-wing", "terra-pulse"] as const).map((id, i) => <li key={id} aria-current={sequence.stage % 3 === i ? "step" : undefined}>
        <span aria-hidden="true">{abilities[id].symbol}</span> {abilities[id].name}<small>{i < sequence.stage % 3 ? "Connected" : i === sequence.stage % 3 ? "Current" : "Next"}</small>
      </li>)}
    </ol>}
    {connectionMessage && <p role="status" className="story-connection">{connectionMessage}</p>}
    {stageDone && <div className="story-stage-complete"><p>Stage connected. Take a breath.</p><button className="rv-btn rv-btn-primary" onClick={onContinue}>Continue to {abilities[realm.stages[sequence.stage + 1]?.ability ?? stage.ability].name} →</button></div>}
  </section>;
}
