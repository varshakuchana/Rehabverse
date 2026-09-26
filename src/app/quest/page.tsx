"use client";

import Link from "next/link";
import { useState } from "react";

type HEPExercise = {
  name: string;
  sets: number | null;
  repetitions: number | null;
  holdSeconds: number | null;
  instructions: string | null;
  notes: string | null;
};

type ConfirmedPlan = {
  id: string;
  sourceFileName: string;
  uploadedAt: string;
  exercises: HEPExercise[];
  frequency?: {
    sessionsPerWeek: number | null;
    specifiedDays: string[] | null;
    rawText: string | null;
  };
  confirmed: boolean;
};

export default function QuestPage() {
  const [plan] = useState<ConfirmedPlan | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const savedPlan = sessionStorage.getItem(
      "rehabverse-confirmed-hep"
    );

    if (!savedPlan) {
      return null;
    }

    try {
      return JSON.parse(savedPlan) as ConfirmedPlan;
    } catch {
      return null;
    }
  });

  if (!plan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-4xl">📄</div>

          <h1 className="mt-5 text-2xl font-bold">
            No confirmed HEP yet
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Upload and review your Home Exercise Program before creating
            your RehabVerse quest.
          </p>

          <Link
            href="/hep"
            className="mt-6 inline-block rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold transition hover:bg-indigo-400"
          >
            Upload My HEP
          </Link>
        </div>
      </main>
    );
  }

  const playableExercises = plan.exercises.filter((exercise) => {
    const name = exercise.name.toLowerCase();

    return (
      name.includes("squat") ||
      name.includes("sit to stand") ||
      name.includes("sit-to-stand")
    );
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← RehabVerse
          </Link>

          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-200">
            ✓ HEP Confirmed
          </div>
        </nav>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-400/10 text-4xl">
            ✨
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Your RehabVerse
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Today&apos;s Quest
          </h1>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-300">
            Your confirmed HEP is ready. RehabVerse will use the
            instructions from your uploaded plan while supported movements
            become interactive challenges.
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Exercises
              </p>

              <p className="mt-2 text-3xl font-black">
                {plan.exercises.length}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                extracted and confirmed
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Interactive now
              </p>

              <p className="mt-2 text-3xl font-black text-cyan-300">
                {playableExercises.length}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                camera-supported movements
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Source
              </p>

              <p className="mt-3 truncate text-sm font-semibold">
                {plan.sourceFileName}
              </p>

              <p className="mt-2 text-xs text-emerald-300">
                ✓ reviewed by you
              </p>
            </div>
          </div>

          {plan.frequency?.rawText && (
            <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                Plan frequency
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {plan.frequency.rawText}
              </p>
            </div>
          )}

          <div className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
                  Quest path
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Your confirmed exercises
                </h2>
              </div>

              <span className="text-xs text-slate-500">
                {plan.exercises.length} movements
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {plan.exercises.map((exercise, index) => {
                const normalizedName = exercise.name.toLowerCase();

                const isSquat =
                  normalizedName.includes("squat") ||
                  normalizedName.includes("sit to stand") ||
                  normalizedName.includes("sit-to-stand");

                return (
                  <article
                    key={`${exercise.name}-${index}`}
                    className={`rounded-2xl border p-5 ${
                      isSquat
                        ? "border-cyan-400/30 bg-cyan-400/[0.06]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                            isSquat
                              ? "bg-cyan-400/10 text-cyan-300"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold capitalize">
                              {exercise.name}
                            </h3>

                            {isSquat ? (
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                                Interactive
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Guided
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                            {exercise.sets !== null && (
                              <span>{exercise.sets} sets</span>
                            )}

                            {exercise.repetitions !== null && (
                              <span>• {exercise.repetitions} reps</span>
                            )}

                            {exercise.holdSeconds !== null && (
                              <span>• Hold {exercise.holdSeconds}s</span>
                            )}

                            {exercise.sets === null &&
                              exercise.repetitions === null &&
                              exercise.holdSeconds === null && (
                                <span>Dosage not specified in HEP</span>
                              )}
                          </div>
                        </div>
                      </div>

                      {isSquat ? (
                        <Link
                          href="/session/squat"
                          className="shrink-0 rounded-xl bg-cyan-400 px-5 py-2.5 text-center text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                        >
                          Play →
                        </Link>
                      ) : (
                        <span className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-500">
                          Guided mode
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {playableExercises.length > 0 ? (
            <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.08] to-indigo-400/[0.08] p-7">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Interactive movement available
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    Your HEP contains a movement RehabVerse can track.
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    We&apos;ll use the camera to recognize the supported
                    movement while keeping the exercise instructions from
                    your confirmed plan.
                  </p>
                </div>

                <Link
                  href="/session/squat"
                  className="shrink-0 rounded-xl bg-cyan-400 px-6 py-3 text-center font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Begin Quest →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
              <p className="font-semibold text-amber-200">
                No camera-supported movement matched yet.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your HEP is still saved for guided sessions. RehabVerse
                currently has interactive tracking for a limited set of
                movements in this prototype.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/hep"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              Review / Upload HEP
            </Link>

            <Link
              href="/explore"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              Explore RehabVerse
            </Link>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-500">
            RehabVerse is a hackathon prototype and does not diagnose,
            prescribe, or replace professional healthcare guidance. Follow
            the instructions and limits in your care plan.
          </p>
        </section>
      </div>
    </main>
  );
}