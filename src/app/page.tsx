import IslandPresentation from "@/components/IslandPresentation";
import SiteNav from "@/components/SiteNav";
import Link from "next/link";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      <IslandPresentation backdrop />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        {/* Navigation */}
        <SiteNav current="home" />

        {/* Hero */}
        <section className="flex flex-1 flex-col items-center justify-center py-16">
          <div className="mb-5 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-sm font-medium text-indigo-200">
            ✨ Your movement changes the world
          </div>

          <h1 className="max-w-4xl text-center text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            Turn movement into an{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              interactive adventure.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-center text-lg leading-8 text-slate-300">
            Transform an existing home exercise plan into interactive
            movement quests, or jump into built-in movement games and
            experience RehabVerse instantly.
          </p>

          {/* Main choices */}
          <div className="mt-12 grid w-full max-w-5xl gap-6 md:grid-cols-2">
            {/* HEP */}
            <Link
              href="/hep"
              className="rv-glass group relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-indigo-500/10 p-8 transition duration-300 hover:-translate-y-1 hover:border-indigo-300/60 hover:bg-indigo-500/15 hover:shadow-2xl hover:shadow-indigo-950/40"
            >
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl transition group-hover:bg-indigo-400/30" />

              <div className="relative">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-3xl">
                  📄
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-2xl font-bold">
                    My HEP
                  </h2>

                  <span className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                    AI Powered
                  </span>
                </div>

                <p className="leading-7 text-slate-300">
                  Already have a Home Exercise Program from your
                  physical therapist? Upload it and turn the existing
                  plan into interactive quests.
                </p>

                <div className="mt-8 flex items-center gap-2 font-semibold text-indigo-300">
                  Upload my plan
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </div>
            </Link>

            {/* Explore */}
            <Link
              href="/explore"
              className="rv-glass group relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-8 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:shadow-2xl hover:shadow-cyan-950/30"
            >
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl transition group-hover:bg-cyan-400/20" />

              <div className="relative">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-3xl">
                  🎮
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-2xl font-bold">
                    Explore with Nova
                  </h2>

                  <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    No HEP needed
                  </span>
                </div>

                <p className="leading-7 text-slate-300">
                  No exercise plan? Tell Nova what kind of general movement
                  experience you want and build a quest from our supported library.
                </p>

                <div className="mt-8 flex items-center gap-2 font-semibold text-cyan-300">
                  Start exploring
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-6 grid w-full max-w-5xl gap-6 md:grid-cols-[2fr_1fr]">
            <Link href="/story" className="rv-glass group rounded-3xl border border-amber-300/40 p-8 transition hover:border-amber-200">
              <p className="text-xs uppercase tracking-[.2em] text-amber-200">A new journey awaits</p>
              <h2 className="mt-3 text-3xl font-bold">Story Mode</h2>
              <p className="mt-2 text-xl text-amber-100">The Shattered Realms</p>
              <p className="mt-4 leading-7 text-slate-200">Enter the Shattered Realms and restore a world powered by your movement.</p>
              <p className="mt-4 text-xs text-slate-300">General movement game — not personalized medical treatment.</p>
              <p className="mt-6 font-semibold text-amber-200">Begin your journey →</p>
            </Link>
            <Link href="/progress" className="rv-glass rounded-3xl p-8 transition hover:border-cyan-200">
              <h2 className="text-2xl font-bold">Progress</h2>
              <p className="mt-4 leading-7 text-slate-300">See your HEP and Explore activity history. Story fragments live on the Story world map.</p>
              <p className="mt-6 font-semibold text-cyan-200">Open your journal →</p>
            </Link>
          </div>

          {/* How it works */}
          <div className="mt-14 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-2xl">👁️</div>
              <p className="font-semibold">See your movement</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Camera-based pose tracking follows supported body
                movements in real time.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-2xl">⚡</div>
              <p className="font-semibold">Power the world</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Physical movement becomes energy that drives interactive
                challenges.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-2xl">🌱</div>
              <p className="font-semibold">Build consistency</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Complete sessions and watch your RehabVerse evolve over
                time.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-center text-xs leading-5 text-slate-500">
          RehabVerse is a hackathon prototype. It does not diagnose,
          prescribe, or replace guidance from a qualified healthcare
          professional.
        </footer>
      </div>
    </main>
  );
}