import IslandPresentation from "@/components/IslandPresentation";
import SiteNav from "@/components/SiteNav";
import WorldPostcard from "@/components/WorldPostcard";
import { THEMES } from "@/lib/worldTheme";
import Link from "next/link";
import type { WorldKind } from "@/lib/rehabWorld/worlds";

const WORLDS: { world: WorldKind; exercise: string; line: string }[] = [
  { world: "well", exercise: "Squats and sit to stand", line: "The bucket drops as you lower and comes up as you stand. Each rep waters a flower bed." },
  { world: "flock", exercise: "Arm raises", line: "A bird lifts its wings with your arm. Each rep, one more bird joins the flock over the sea." },
  { world: "cairn", exercise: "Holds and balance", line: "Every hold you finish sets one more stone on the cairn by the lake." },
  { world: "orbit", exercise: "Everything else", line: "Follow along and mark each rep. Each one sends a moon into orbit." },
];

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="rv-home rv-scene relative isolate min-h-screen overflow-hidden bg-[#1E2240]">
      <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,#1E2240_0%,#34355E_55%,#6A5C7D_100%)]" />
      <IslandPresentation backdrop />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-6">
        <SiteNav current="home" />

        <section className="grid min-h-[78vh] items-center gap-10 py-6 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <h1 className="rv-wordmark">RehabVerse</h1>
            <p className="mt-6 max-w-[34ch] text-[clamp(19px,1.7vw,24px)] leading-snug">
              Your physical therapist&apos;s home exercises, turned into small worlds you bring back to life one rep at a time.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/hep" className="rv-btn rv-btn-primary rv-btn-big">Use my PT&apos;s plan</Link>
              <Link href="/explore" className="rv-btn rv-btn-ghost rv-btn-big">Play without a plan</Link>
            </div>
            <p className="mt-6 max-w-[52ch] text-[15px] opacity-75">
              RehabVerse follows your therapist&apos;s plan. It doesn&apos;t diagnose anything or change your exercises.
            </p>
          </div>

          <div className="grid gap-4">
            <Link href="/story" className="group relative block overflow-hidden rounded-[28px] border border-[#F2C14E]/50 bg-[rgba(24,28,54,.78)] p-7 backdrop-blur-md transition hover:border-[#F2C14E]">
              <div aria-hidden className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-[#F2C14E]/20 blur-3xl transition group-hover:bg-[#F2C14E]/30" />
              <p className="rv-eyebrow">Story Mode</p>
              <h2 className="mt-1 font-display text-[clamp(30px,3vw,42px)] font-extrabold leading-none tracking-tight">The Shattered Realms</h2>
              <p className="mt-3 max-w-[40ch] text-[17px] opacity-90">Four realms, three movement abilities, one broken world. Restore the Motion Core with your own body.</p>
              <p className="mt-5 font-display text-lg font-semibold text-[#F2C14E]">Begin the journey <span aria-hidden className="inline-block transition group-hover:translate-x-1">→</span></p>
            </Link>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/quest" className="rv-glass block rounded-[24px] p-6 transition hover:bg-[rgba(24,28,54,.95)]">
                <h2 className="font-display text-xl font-bold">Today&apos;s quest</h2>
                <p className="mt-1 text-[16px] opacity-80">Your confirmed plan, one stop at a time.</p>
              </Link>
              <Link href="/progress" className="rv-glass block rounded-[24px] p-6 transition hover:bg-[rgba(24,28,54,.95)]">
                <h2 className="font-display text-xl font-bold">Progress</h2>
                <p className="mt-1 text-[16px] opacity-80">Every finished quest, saved on this device.</p>
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="worlds-h" className="pb-14">
          <h2 id="worlds-h" className="font-display text-[clamp(30px,3.4vw,46px)] font-extrabold tracking-tight">Every exercise gets its own world</h2>
          <p className="mt-2 max-w-[60ch] text-[18px] opacity-85">The world reacts to the movement you&apos;re doing, so the game always matches the exercise.</p>
          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORLDS.map(({ world, exercise, line }) => (
              <li key={world} className="overflow-hidden rounded-[24px] border border-white/15 bg-[rgba(24,28,54,.8)]">
                <div className="aspect-[16/9]"><WorldPostcard world={world} /></div>
                <div className="p-5">
                  <p className="text-[15px] font-semibold" style={{ color: THEMES[world].accent }}>{exercise}</p>
                  <h3 className="mt-0.5 font-display text-xl font-bold leading-tight">{THEMES[world].quest}</h3>
                  <p className="mt-2 text-[15px] leading-snug opacity-80">{line}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-h" className="grid gap-6 border-t border-white/15 py-12 lg:grid-cols-[.8fr_2fr]">
          <h2 id="how-h" className="font-display text-3xl font-extrabold tracking-tight">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              ["Upload the sheet", "A PDF or photo of the home exercise plan your PT gave you. Gemini reads it."],
              ["Check it yourself", "You pick which exercises to include and fix anything the reader got wrong."],
              ["Play it", "The camera counts supported movements. Anything else, you follow along and mark."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2C14E] font-display text-lg font-bold text-[#2A2410]">{i + 1}</span>
                <div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 text-[16px] leading-snug opacity-80">{text}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="border-t border-white/15 py-5 text-[14px] leading-6 opacity-70">
          RehabVerse is a hackathon prototype. It does not diagnose, prescribe, or replace guidance from a qualified healthcare professional.
        </footer>
      </div>
    </main>
  );
}
