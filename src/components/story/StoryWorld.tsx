"use client";
import IslandPresentation from "@/components/IslandPresentation";
import type { SessionVisualState } from "@/types/sessionPresentation";
import type { AbilityId, StoryProgress, StoryRealm, StorySequence } from "@/types/story";
import { abilities, storyRealms } from "@/data/storyCampaign";
import { AbilityOrb, FragmentGem, Pips } from "./StoryArt";
import Cutebot, { type BotPose } from "./Cutebot";

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

export type StoryToast = { kind: "stage" | "realm"; title: string; sub?: string; gemColor?: string; next?: AbilityId } | null;

const CUES: Record<AbilityId, { say: string; where: string }> = {
  "lumen-rise": { say: "Arm forward and up", where: "Stand side-on to the camera" },
  "aether-wing": { say: "Arm out to the side", where: "Face the camera" },
  "terra-pulse": { say: "Bend your knees, then stand", where: "Show me hips to ankles" },
};
export const FRAGMENT_COLORS: Record<string, string> = { "Grove Fragment": "#91D5A0", "Crystal Fragment": "#B69CFF", "Sky Fragment": "#8FD8F0" };

/** What the guide bot says and does, from the tracker's visible state. Short on purpose. */
function guide(visual: SessionVisualState, ability: AbilityId, autoStart: boolean, toast: StoryToast): { pose: BotPose; say: string; hint: string } {
  const cue = CUES[ability];
  if (toast) return toast.next
    ? { pose: "cheer", say: toast.title, hint: `Next: ${abilities[toast.next].name}. ${CUES[toast.next].where}.` }
    : { pose: "cheer", say: toast.title, hint: toast.sub ?? "" };
  const s = visual.sessionState;
  if (s === "active" && !visual.bodyDetected) return { pose: "look", say: "I lost you!", hint: "Step back into view." };
  if (s === "active") return { pose: ability, say: cue.say, hint: visual.movementPhase === "returning" ? "Now back down, slowly." : "Comfortable range, your pace." };
  if (s === "countdown") return { pose: ability, say: "Get ready…", hint: "Watch me first." };
  if (s === "ready") return autoStart ? { pose: ability, say: "Perfect, stay there", hint: "Starting in a moment." } : { pose: "wave", say: 'Say "Start"!', hint: "Or tap Start." };
  if (s === "complete") return { pose: "cheer", say: "Connected!", hint: "" };
  return { pose: visual.bodyDetected ? ability : "look", say: "Where are you?", hint: cue.where + "." };
}

export default function StoryWorld({ realm, realmIndex, sequence, progress, visual, toast, connectionMessage, autoStart }: {
  realm: StoryRealm; realmIndex: number; sequence: StorySequence; progress: StoryProgress; visual: SessionVisualState;
  toast: StoryToast; connectionMessage: string; autoStart: boolean;
}) {
  const stage = realm.stages[Math.min(sequence.stage, realm.stages.length - 1)];
  const ability = abilities[stage.ability];
  const zones = realmRestoration(progress);
  const fraction = (sequence.stage + visual.reps / visual.target) / realm.stages.length;
  zones[realm.zone] = Math.max(zones[realm.zone], fraction);
  if (realm.id === "sleeping-grove") zones[3] = fraction;
  const active = visual.sessionState === "active";
  const g = guide(visual, stage.ability, autoStart, toast);

  return <section className={`story-world ${active || toast ? "is-active" : ""}`} aria-label={`${realm.name} game world`} style={{ "--ability-color": ability.accent } as React.CSSProperties}>
    <IslandPresentation completedReps={visual.reps} targetReps={visual.target} channeling={active && visual.bodyDetected && (visual.movementPhase === "moving" || visual.movementPhase === "returning")} focus={realm.zone} zoneProgress={zones} ability={stage.ability} finale={realm.id === "motion-core"} landmarks={visual.landmarks} bodyReady={visual.bodyDetected} celebrated={toast?.kind === "realm" && realm.id === "motion-core"}>
      <DormantIsland fraction={fraction} />
    </IslandPresentation>

    {/* the whole journey at a glance */}
    <ol className="story-journey" aria-label="Journey through the realms">
      {storyRealms.map((r, i) => {
        const done = progress.completedLevels.includes(r.levelId);
        const fill = done ? 1 : i === realmIndex ? fraction : 0;
        return <li key={r.id} aria-current={i === realmIndex ? "step" : undefined}>
          <span className="story-journey-gem">{r.fragment ? <FragmentGem lit={done} size={22} color={FRAGMENT_COLORS[r.fragment]} /> : <AbilityOrb id="lumen-rise" size={20} lit={progress.storyCompleted} />}</span>
          <span className="story-journey-bar"><span style={{ width: `${fill * 100}%` }} /></span>
          <span className="sr-only">{r.name}{done ? ", restored" : i === realmIndex ? ", in progress" : ""}</span>
        </li>;
      })}
    </ol>

    <div className="story-world-heading">
      <h2>{realm.name}</h2>
      <p>{stage.objective}</p>
    </div>

    {realm.sequence && <ol className="story-pattern" aria-label={`Pattern ${Math.floor(sequence.stage / 3) + 1} of 2`}>
      {(["lumen-rise", "aether-wing", "terra-pulse"] as const).map((id, i) => {
        const pos = sequence.stage % 3;
        const state = i < pos ? "Connected" : i === pos ? "Current" : "Next";
        return <li key={id} aria-current={i === pos ? "step" : undefined} data-state={state.toLowerCase()}>
          <AbilityOrb id={id} size={i === pos ? 46 : 36} lit={i <= pos} pulse={i === pos} />
          <span className="sr-only">{abilities[id].name}: {state}</span>
        </li>;
      })}
    </ol>}

    {/* the guide: a tiny robot showing what to do, one line at a time */}
    <div className="story-guide" aria-live="polite">
      <Cutebot pose={g.pose} accent={ability.accent} size={92} />
      <div className="story-guide-bubble">
        <p className="story-guide-say">{g.say}</p>
        {g.hint && <p className="story-guide-hint">{g.hint}</p>}
        {!toast && <div className="story-guide-meta"><span style={{ color: ability.accent }}>{ability.name}</span><Pips done={visual.reps} total={visual.target} color={ability.accent} /></div>}
      </div>
    </div>

    {connectionMessage && !toast && <p role="status" className="story-connection">{connectionMessage}</p>}
    {toast && <div className={`story-toast story-toast-${toast.kind}`} role="status">
      {toast.kind === "realm" ? <FragmentGem lit size={90} color={toast.gemColor} /> : <AbilityOrb id={stage.ability} size={80} />}
      <p>{toast.title}</p>
      {toast.sub && <small>{toast.sub}</small>}
    </div>}
  </section>;
}
