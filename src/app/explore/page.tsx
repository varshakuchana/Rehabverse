import Link from "next/link";
import { exercises } from "@/data/exercises";

export default function ExplorePage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-300"><Link href="/">← RehabVerse</Link><div className="flex gap-5"><Link href="/progress" className="hover:text-cyan-200">My Progress</Link><Link href="/hep" className="hover:text-indigo-200">My HEP</Link></div></nav>
        <header className="relative py-14 sm:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <p className="text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">Explore · No plan required</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Make a little time<br />for a little <span className="bg-gradient-to-r from-cyan-200 to-indigo-300 bg-clip-text text-transparent">magic.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Meet Nova, try a movement quest, and wake a world of light. Three built-in experiences for general movement and wellness—no HEP upload needed.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-xs text-cyan-100"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-4 py-2">✦ Nova guides the way</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-4 py-2">One movement, one spark</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-4 py-2">Progress saved on this device</span></div>
        </header>
        <section aria-label="Choose your experience">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-semibold">Choose your next spark</h2><p className="text-sm text-slate-400">Explore targets are game challenges, not medical dosage.</p></div>
          <div className="grid gap-5 lg:grid-cols-3">{exercises.map((exercise, index) => {
            const interactive = exercise.trackingCapability === "interactive";
            return <article key={exercise.id} className={`group flex flex-col overflow-hidden rounded-3xl border ${interactive ? "border-cyan-300/40 bg-cyan-400/[.06]" : "border-indigo-300/20 bg-indigo-400/[.04]"}`}>
              <div aria-hidden="true" className="relative flex h-40 items-center justify-center overflow-hidden border-b border-white/5 bg-gradient-to-br from-indigo-400/10 via-transparent to-cyan-300/10">
                <div className="absolute h-28 w-28 rounded-full border border-indigo-300/15" /><div className="absolute h-36 w-36 rounded-full border border-cyan-300/10" />
                <span className="text-6xl text-cyan-200 drop-shadow-[0_0_24px_#67e8f970]">{["✦", "✧", "◌"][index]}</span>
                <span className="absolute bottom-4 left-5 text-xs tracking-[.2em] text-slate-400">WORLD 0{index + 1}</span>
                {interactive && <span className="absolute right-4 top-4 rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">Featured quest</span>}
              </div>
              <div className="flex flex-1 flex-col p-6"><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${interactive ? "border-cyan-300/30 text-cyan-200" : "border-violet-300/30 text-violet-200"}`}>{interactive ? "Interactive · Camera tracked" : "Guided · You mark completion"}</span><h3 className="mt-4 text-2xl font-semibold">{exercise.name}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{exercise.description}</p><p className="mt-5 text-sm font-semibold text-cyan-100">{exercise.quest.target} movements · Explore challenge</p><p className="mt-2 text-xs leading-5 text-slate-400">{interactive ? "Hip, knee, and ankle tracking. Voice or manual Start." : "No camera or microphone. No automated movement verification."}</p><Link href={exercise.sessionRoute!} className={`mt-6 block rounded-xl px-5 py-3 text-center font-semibold transition ${interactive ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200" : "bg-indigo-500 text-white hover:bg-indigo-400"}`}>{interactive ? "Enter Movement Quest" : "Meet Nova & begin"} →</Link></div>
            </article>;
          })}</div>
        </section>
        <section className="my-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-6"><h2 className="font-semibold text-cyan-100">Two ways to play, one world to restore</h2><p className="mt-3 text-sm leading-6 text-slate-300">Interactive uses camera tracking to recognize completed movements. Guided uses your own completion taps. Both send equal sparks to the garden, without bonuses for speed or range.</p></div>
          <div className="rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-6"><h2 className="font-semibold text-indigo-100">Following a therapist-provided plan?</h2><p className="mt-3 text-sm leading-6 text-slate-300">My HEP is a separate path using the instructions and dosage in your confirmed plan. Explore activity does not count toward your HEP schedule.</p><Link href="/hep" className="mt-4 inline-block text-sm font-semibold text-indigo-200">Go to My HEP →</Link></div>
        </section>
        <p className="pb-6 text-xs leading-6 text-slate-400">Explore is a general movement experience, not injury treatment. Move comfortably, stop if you experience discomfort, and follow any existing care-plan limits.</p>
      </div>
    </main>
  );
}
