import { notFound } from "next/navigation";
import GuidedQuest from "@/components/GuidedQuest";
import { guidedQuests } from "@/data/exploreQuests";

export default async function GuidedQuestPage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const definition = guidedQuests.find(quest => quest.exerciseId === exerciseId && quest.trackingCapability === "guided");
  if (!definition) notFound();
  return <GuidedQuest key={definition.exerciseId} definition={definition} />;
}
