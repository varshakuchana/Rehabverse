import SiteNav from "@/components/SiteNav";
import ExploreNovaCreator from "@/components/ExploreNovaCreator";
import WorldPostcard from "@/components/WorldPostcard";
import Link from "next/link";
import { exercises } from "@/data/exercises";
import { THEMES, worldFor } from "@/lib/worldTheme";

export default function ExplorePage() {
  return (
    <main id="main-content" tabIndex={-1} className="rv-scene relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#1E2240_0%,#2B2B52_60%,#3A3160_100%)]">
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <SiteNav current="explore" />
        <header className="grid gap-8 py-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div className="pt-4">
            <p className="rv-eyebrow">Explore, no plan needed</p>
            <h1 className="mt-2 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[.93] tracking-tight">Try a movement</h1>
            <p className="mt-5 max-w-[40ch] text-[19px] leading-snug opacity-90">Pick a world below, or ask Nova to put a few together for you. These are general movements, not a prescription.</p>
            <p className="mt-5 max-w-[46ch] text-[15px] opacity-70">Following a plan from your PT? <Link href="/hep" className="rv-link">Use My HEP instead.</Link> Explore sessions don&apos;t count toward your plan.</p>
          </div>
          <ExploreNovaCreator />
        </header>

        <section aria-labelledby="library-h" className="pb-10">
          <h2 id="library-h" className="font-display text-3xl font-extrabold tracking-tight">Pick a world</h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((exercise) => {
              const world = worldFor(exercise.quest);
              const theme = THEMES[world];
              const interactive = exercise.trackingCapability === "interactive";
              return (
                <li key={exercise.id}>
                  <Link href={exercise.sessionRoute!} className="group flex h-full flex-col overflow-hidden rounded-[24px] border-2 bg-[rgba(24,28,54,.8)] transition hover:-translate-y-0.5" style={{ borderColor: `${theme.accent}88` }}>
                    <div className="relative aspect-[16/9]">
                      <WorldPostcard world={world} />
                      <span className="absolute left-3 top-3 rounded-full bg-[rgba(18,20,40,.75)] px-3 py-1 text-[13px] font-semibold backdrop-blur">{interactive ? "Camera tracked" : "Guided"}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-[15px] font-semibold" style={{ color: theme.accent }}>{exercise.name}</p>
                      <h3 className="mt-0.5 font-display text-2xl font-bold leading-tight">{theme.quest}</h3>
                      <p className="mt-2 flex-1 text-[16px] leading-snug opacity-80">{theme.goal}</p>
                      <p className="mt-4 font-display font-semibold" style={{ color: theme.accent }}>Play <span aria-hidden className="inline-block transition group-hover:translate-x-1">→</span></p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="border-t border-white/15 py-5 text-[14px] leading-6 opacity-70">Explore is a general movement experience, not injury treatment. Move comfortably, stop if you feel discomfort, and follow any existing care-plan limits.</p>
      </div>
    </main>
  );
}
