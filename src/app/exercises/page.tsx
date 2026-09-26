import Link from "next/link";

export default function ExercisesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-10 inline-block text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Home
        </Link>

        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Choose Your Movement
          </p>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Rehabilitation Challenges
          </h1>

          <p className="mx-auto max-w-2xl text-slate-400">
            Choose a supported movement to begin your RehabVerse session.
            Each movement controls a different action inside the game.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Squat Challenge */}
          <div className="rounded-2xl border border-indigo-400/40 bg-white/5 p-7">
            <div className="mb-5 text-5xl">🦵</div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">
                Squat Challenge
              </h2>

              <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">
                Available
              </span>
            </div>

            <p className="mb-6 leading-7 text-slate-400">
              Complete controlled squat movements to make your character jump
              over obstacles.
            </p>

            <div className="mb-6 rounded-xl bg-slate-900/50 p-4">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">
                  Game action:
                </span>{" "}
                Jump
              </p>

              <p className="mt-2 text-sm text-slate-300">
                <span className="font-semibold text-white">
                  Prototype target:
                </span>{" "}
                10 repetitions
              </p>
            </div>

            <Link
              href="/session/squat"
              className="block w-full rounded-xl bg-indigo-500 px-5 py-3 text-center font-semibold transition hover:bg-indigo-400"
            >
              Start Squat Challenge
            </Link>
          </div>

          {/* Arm Raise */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7 opacity-60">
            <div className="mb-5 text-5xl">🙌</div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">
                Arm Raise
              </h2>

              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
                Coming Soon
              </span>
            </div>

            <p className="mb-6 leading-7 text-slate-400">
              Raise your arms through a configured movement to help your
              character climb and reach objects.
            </p>

            <button
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-slate-700 px-5 py-3 font-semibold text-slate-400"
            >
              Coming Soon
            </button>
          </div>

          {/* Side Movement */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7 opacity-60">
            <div className="mb-5 text-5xl">↔️</div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">
                Side Movement
              </h2>

              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
                Coming Soon
              </span>
            </div>

            <p className="mb-6 leading-7 text-slate-400">
              Perform controlled lateral movements to guide your character
              around obstacles.
            </p>

            <button
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-slate-700 px-5 py-3 font-semibold text-slate-400"
            >
              Coming Soon
            </button>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-6 text-amber-100/80">
          RehabVerse does not prescribe rehabilitation exercises. The prototype
          demonstrates how a supported, pre-selected movement can be transformed
          into interactive gameplay.
        </div>
      </div>
    </main>
  );
}