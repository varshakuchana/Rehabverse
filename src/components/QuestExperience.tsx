"use client";
import type { QuestDefinition } from "@/types/quest";
import GuidedQuest from "./GuidedQuest";
import TrackedQuest from "./TrackedQuest";
export default function QuestExperience({ definition, onContinue }: { definition: QuestDefinition; onContinue?: () => void }) {
  return definition.trackingCapability === "interactive" ? <TrackedQuest definition={definition} onContinue={onContinue} /> : <GuidedQuest definition={definition} onContinue={onContinue} />;
}
