import Link from "next/link";

export default function HEPPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to RehabVerse
          </Link>

          <div className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-xs font-medium text-indigo-200">
            My HEP
          </div>
        </nav>

        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-indigo-400/20 bg-indigo-500/10 text-4xl">
            📄
          </div>

          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">
            Transform My HEP
          </p>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Turn your exercise plan into
            <span className="block bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              an interactive quest.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl leading-7 text-slate-300">
            Upload the Home Exercise Program provided by your physical
            therapist. RehabVerse will help turn supported exercises from
            that existing plan into interactive movement experiences.
          </p>
        </section>

        <section className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-3xl border border-dashed border-indigo-400/30 bg-white/[0.04] p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">
              📤
            </div>

            <h2 className="text-xl font-bold">
              Upload your Home Exercise Program
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
              Add the PDF or image you received from your physical therapist.
              You&apos;ll review everything RehabVerse reads before anything
              is added to your plan.
            </p>

            <button
              type="button"
              disabled
              className="mt-7 cursor-not-allowed rounded-xl bg-indigo-500/50 px-6 py-3 font-semibold text-indigo-100"
            >
              Choose HEP File
            </button>

            <p className="mt-3 text-xs text-slate-500">
              PDF and image import will be connected in the next build step.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-xl">1️⃣</div>
              <h3 className="font-semibold">Upload</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Add the exercise plan already provided to you.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-xl">2️⃣</div>
              <h3 className="font-semibold">Review</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Confirm the exercises and instructions that were extracted.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-xl">3️⃣</div>
              <h3 className="font-semibold">Play</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Turn supported movements into interactive RehabVerse quests.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/10 bg-amber-400/5 p-5">
            <p className="text-sm leading-6 text-slate-400">
              <span className="font-semibold text-amber-200">
                Your care plan stays in control.
              </span>{" "}
              RehabVerse does not create a new rehabilitation prescription.
              Always follow the instructions and limits provided by your
              healthcare professional.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}