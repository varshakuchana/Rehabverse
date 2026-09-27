import type { Metadata } from "next";
import StoryCampaign from "@/components/story/StoryCampaign";
import "./story.css";
export const metadata: Metadata = { title: "The Shattered Realms | RehabVerse", description: "A story-driven general movement game. Restore four realms, collect Motion Fragments, and rebuild the Motion Core." };
export default function StoryPage() { return <StoryCampaign />; }
