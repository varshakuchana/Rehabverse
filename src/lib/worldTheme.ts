import type { QuestDefinition } from "@/types/quest";
import type { WorldKind } from "@/lib/rehabWorld/worlds";
import type { DemoKind } from "@/components/DemoFigure";

/*
  Presentation only. Picks the world a quest is played in and the words
  around it. Tracked quests use the authoritative detectorId; Guided quests
  get a world by name only for decoration. Nothing here affects counting,
  targets, completion or saving.
*/

export type WorldTheme = {
  accent: string;
  ink: string;
  quest: string;
  unit: string;
  goal: string;
  done: string;
  skyDim: string;
  skyBright: string;
};

export const THEMES: Record<WorldKind, WorldTheme> = {
  well: {
    accent: "#F2C14E", ink: "#2A2410",
    quest: "Draw water for the garden", unit: "reps",
    goal: "Each movement hauls up a bucket and waters one garden bed.",
    done: "The garden is in bloom.",
    skyDim: "linear-gradient(180deg,#2A2F5A 0%,#6E5C86 55%,#E7A983 100%)",
    skyBright: "linear-gradient(180deg,#8CC8E8 0%,#CDE8F0 55%,#FBE7B5 100%)",
  },
  flock: {
    accent: "#FF9A76", ink: "#3A1A10",
    quest: "Help the birds take flight", unit: "birds",
    goal: "Lift your arm and the bird lifts its wings. Each movement sends one bird to the flock.",
    done: "The whole flock is flying.",
    skyDim: "linear-gradient(180deg,#1D2445 0%,#4D3D66 55%,#C77B78 100%)",
    skyBright: "linear-gradient(180deg,#7FB2D8 0%,#F6C1A8 60%,#FFE0B0 100%)",
  },
  cairn: {
    accent: "#8FD8F0", ink: "#0E2A33",
    quest: "Stack the stones by the lake", unit: "stones",
    goal: "Each hold you finish sets one stone on the cairn.",
    done: "The cairn stands tall.",
    skyDim: "linear-gradient(180deg,#0F1A33 0%,#23385A 55%,#4F6A8A 100%)",
    skyBright: "linear-gradient(180deg,#3E6D96 0%,#8DB8CF 55%,#E9D9C0 100%)",
  },
  orbit: {
    accent: "#B69CFF", ink: "#1B1535",
    quest: "Set the moons in orbit", unit: "moons",
    goal: "Each movement you mark sends a moon into orbit.",
    done: "Every moon is in orbit.",
    skyDim: "linear-gradient(180deg,#07081A 0%,#141236 55%,#221A48 100%)",
    skyBright: "linear-gradient(180deg,#120F35 0%,#2E1E5E 55%,#4B2C6E 100%)",
  },
};

export function worldFor(definition: Pick<QuestDefinition, "detectorId" | "instructor" | "trackingCapability" | "holdSeconds">): WorldKind {
  if (definition.trackingCapability === "interactive") {
    return definition.detectorId?.startsWith("shoulder") ? "flock" : "well";
  }
  if (definition.holdSeconds || /balance|single[ -]leg|one[ -]leg|stance/i.test(definition.instructor.name)) return "cairn";
  return "orbit";
}

export function demoFor(definition: Pick<QuestDefinition, "detectorId" | "instructor">): DemoKind | null {
  if (definition.detectorId === "knee_flexion") return "squat";
  if (definition.detectorId === "shoulder_flexion") return "flexion";
  if (definition.detectorId === "shoulder_abduction") return "abduction";
  if (/ankle/i.test(definition.instructor.name)) return "ankle";
  return null;
}
