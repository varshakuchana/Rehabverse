import Link from "next/link";
import { exercises } from "@/data/exercises";

export default function ExplorePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to RehabVerse
          </Link>

          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-200">
            Explore
          </div>
        </nav>

        <section>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Explore RehabVerse
          </p>

          <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Experience movement-powered
            <span className="block bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              interactive challenges.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Try built-in general movement experiences without uploading a
            Home Exercise Program. Choose a supported challenge below.
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {exercises.map((exercise) => {
            const card = (
              <div
                className={`h-full rounded-3xl border p-7 transition ${
                  exercise.available
                    ? "border-cyan-400/30 bg-cyan-400/[0.06] hover:-translate-y-1 hover:border-cyan-300/60 hover:bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl">
                    {exercise.category === "Lower Body"
                      ? "🦵"
                      : exercise.category === "Upper Body"
                        ? "🙌"
                        : "⚡"}
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      exercise.available
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {exercise.available ? "Playable" : "Coming soon"}
                  </span>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {exercise.category}
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {exercise.name}
                </h2>

                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">
                  {exercise.description}
                </p>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Interaction
                  </p>

                  <p className="mt-2 text-sm font-medium text-slate-300">
                    {exercise.gameMechanic === "movement-energy"
                      ? "Movement → World Energy"
                      : exercise.gameMechanic === "hold-charge"
                        ? "Hold → Charge Energy"
                        : "Movement Challenge"}
                  </p>
                </div>

                <div
                  className={`mt-6 font-semibold ${
                    exercise.available
                      ? "text-cyan-300"
                      : "text-slate-600"
                  }`}
                >
                  {exercise.available
                    ? "Enter challenge →"
                    : "In development"}
                </div>
              </div>
            );

            if (exercise.available && exercise.sessionRoute) {
              return (
                <Link key={exercise.id} href={exercise.sessionRoute}>
                  {card}
                </Link>
              );
            }

            return <div key={exercise.id}>{card}</div>;
          })}
        </section>

        <section className="mt-12 rounded-3xl border border-indigo-400/15 bg-indigo-400/[0.05] p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-200">
                Have a physical therapist&apos;s exercise plan?
              </p>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Explore is for general movement experiences. If you already
                have a Home Exercise Program, use My HEP so RehabVerse can
                work from that existing plan.
              </p>
            </div>

            <Link
              href="/hep"
              className="shrink-0 rounded-xl bg-indigo-500 px-5 py-3 text-center text-sm font-semibold transition hover:bg-indigo-400"
            >
              Transform My HEP
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}