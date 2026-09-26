export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 text-white">
      <div className="mx-auto max-w-4xl text-center">

        <div className="mb-6 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm text-indigo-200">
          🧠 Move • Recover • Play
        </div>

        <h1 className="mb-6 text-6xl font-bold tracking-tight md:text-7xl">
          Rehab
          <span className="text-indigo-400">Verse</span>
        </h1>

        <p className="mx-auto mb-4 max-w-2xl text-xl text-slate-300">
          Turn rehabilitation exercises into an interactive game.
        </p>

        <p className="mx-auto mb-10 max-w-2xl text-base leading-7 text-slate-400">
          RehabVerse uses your camera to track body movement while you complete
          rehabilitation-inspired challenges. Move correctly, complete
          exercises, earn points, and progress through the game.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button className="rounded-xl bg-indigo-500 px-8 py-4 text-lg font-semibold transition hover:bg-indigo-400">
            Start Rehabilitation
          </button>

          <button className="rounded-xl border border-slate-600 bg-slate-900/40 px-8 py-4 text-lg font-semibold text-slate-200 transition hover:bg-slate-800">
            How It Works
          </button>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="mb-4 text-3xl">📷</div>
            <h2 className="mb-2 text-lg font-semibold">
              Camera Tracking
            </h2>
            <p className="text-sm leading-6 text-slate-400">
              Your webcam tracks body position while you perform each movement.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="mb-4 text-3xl">🎯</div>
            <h2 className="mb-2 text-lg font-semibold">
              Movement Challenges
            </h2>
            <p className="text-sm leading-6 text-slate-400">
              Complete rehabilitation movements to interact with challenges
              inside the game.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="mb-4 text-3xl">📈</div>
            <h2 className="mb-2 text-lg font-semibold">
              Progress Feedback
            </h2>
            <p className="text-sm leading-6 text-slate-400">
              See repetitions, movement accuracy, scores, and progress after
              each session.
            </p>
          </div>

        </div>

        <p className="mt-12 text-xs text-slate-500">
          RehabVerse is a hackathon prototype and is not a medical diagnostic
          or treatment tool.
        </p>

      </div>
    </main>
  );
}