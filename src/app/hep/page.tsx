"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";

type ExtractedExercise = {
  name: string;
  sets: number | null;
  repetitions: number | null;
  holdSeconds: number | null;
  instructions: string | null;
  notes: string | null;
};

type ExtractedFrequency = {
  sessionsPerWeek: number | null;
  specifiedDays: string[] | null;
  rawText: string | null;
};

type ExtractedHEP = {
  exercises: ExtractedExercise[];
  frequency: ExtractedFrequency;
  generalInstructions: string[];
  extractionNotes: string[];
};

type AnalyzeResponse = {
  success?: boolean;
  fileName?: string;
  extractedHEP?: ExtractedHEP;
  error?: string;
};

export default function HEPPage() {
    const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedHEP, setExtractedHEP] = useState<ExtractedHEP | null>(
    null
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileError("");
    setAnalysisError("");
    setExtractedHEP(null);

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      setFileError("Please choose a PDF, JPG, PNG, or WEBP file.");
      event.target.value = "";
      return;
    }

    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setSelectedFile(null);
      setFileError(
        "This file is larger than 10 MB. Please choose a smaller file."
      );
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  function chooseFile() {
    fileInputRef.current?.click();
  }

  function removeFile() {
    setSelectedFile(null);
    setFileError("");
    setAnalysisError("");
    setExtractedHEP(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function analyzeHEP() {
    if (!selectedFile || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setExtractedHEP(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/hep/analyze", {
        method: "POST",
        body: formData,
      });

      const data: AnalyzeResponse = await response.json();

      if (!response.ok || !data.success || !data.extractedHEP) {
        throw new Error(
          data.error || "RehabVerse could not analyze this HEP."
        );
      }

      setExtractedHEP(data.extractedHEP);

      window.setTimeout(() => {
        document
          .getElementById("hep-review")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error) {
      console.error(error);

      setAnalysisError(
        error instanceof Error
          ? error.message
          : "RehabVerse could not analyze this HEP."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

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
          <div
            className={`rounded-3xl border border-dashed p-10 text-center transition ${
              selectedFile
                ? "border-emerald-400/30 bg-emerald-400/[0.04]"
                : "border-indigo-400/30 bg-white/[0.04]"
            }`}
          >
            {!selectedFile ? (
              <>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">
                  📤
                </div>

                <h2 className="text-xl font-bold">
                  Upload your Home Exercise Program
                </h2>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
                  Add the PDF or image you received from your physical
                  therapist. You&apos;ll review everything RehabVerse reads
                  before anything is added to your plan.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={chooseFile}
                  className="mt-7 rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white transition hover:bg-indigo-400"
                >
                  Choose HEP File
                </button>

                <p className="mt-3 text-xs text-slate-500">
                  Supported: PDF, JPG, PNG, WEBP • Maximum 10 MB
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-3xl">
                  ✓
                </div>

                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
                  File selected
                </p>

                <h2 className="mt-3 break-words text-xl font-bold">
                  {selectedFile.name}
                </h2>

                <div className="mt-3 flex items-center justify-center gap-3 text-sm text-slate-400">
                  <span>
                    {selectedFile.type === "application/pdf"
                      ? "PDF document"
                      : "Image"}
                  </span>

                  <span>•</span>

                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>

                <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-slate-400">
                  RehabVerse will extract the exercise information in this
                  document. You&apos;ll review the results before the plan is
                  used.
                </p>

                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={chooseFile}
                    disabled={isAnalyzing}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Choose Different File
                  </button>

                  <button
                    type="button"
                    onClick={analyzeHEP}
                    disabled={isAnalyzing}
                    className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Reading your HEP...
                      </span>
                    ) : (
                      "Analyze HEP →"
                    )}
                  </button>
                </div>

                {!isAnalyzing && (
                  <button
                    type="button"
                    onClick={removeFile}
                    className="mt-4 text-xs text-slate-500 transition hover:text-slate-300"
                  >
                    Remove file
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}

            {fileError && (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
                <p className="text-sm text-red-300">{fileError}</p>
              </div>
            )}

            {analysisError && (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
                <p className="font-semibold text-red-300">
                  Analysis failed
                </p>

                <p className="mt-1 text-sm text-red-200/70">
                  {analysisError}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div
              className={`rounded-2xl border p-5 ${
                selectedFile
                  ? "border-emerald-400/20 bg-emerald-400/[0.05]"
                  : "border-indigo-400/20 bg-indigo-400/[0.06]"
              }`}
            >
              <div className="mb-3 text-xl">
                {selectedFile ? "✓" : "1️⃣"}
              </div>

              <h3 className="font-semibold">Upload</h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Add the exercise plan already provided to you.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                extractedHEP
                  ? "border-indigo-400/30 bg-indigo-400/[0.08]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
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

        {extractedHEP && (
          <section
            id="hep-review"
            className="mx-auto mt-16 max-w-4xl scroll-mt-8 pb-20"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl">
                🔎
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                Review before continuing
              </p>

              <h2 className="mt-3 text-3xl font-black">
                Here&apos;s what RehabVerse found
              </h2>

              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                AI document extraction can make mistakes. Compare these
                details with your original HEP before confirming them.
              </p>
            </div>

            <div className="space-y-4">
              {extractedHEP.exercises.length > 0 ? (
                extractedHEP.exercises.map((exercise, index) => (
                  <article
                    key={`${exercise.name}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 font-bold text-indigo-300">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold">
                          {exercise.name}
                        </h3>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {exercise.sets !== null && (
                            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                              {exercise.sets}{" "}
                              {exercise.sets === 1 ? "set" : "sets"}
                            </span>
                          )}

                          {exercise.repetitions !== null && (
                            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                              {exercise.repetitions} reps
                            </span>
                          )}

                          {exercise.holdSeconds !== null && (
                            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                              Hold {exercise.holdSeconds} sec
                            </span>
                          )}

                          {exercise.sets === null &&
                            exercise.repetitions === null &&
                            exercise.holdSeconds === null && (
                              <span className="rounded-lg border border-amber-400/10 bg-amber-400/5 px-3 py-1.5 text-xs text-amber-200">
                                Dosage not specified
                              </span>
                            )}
                        </div>

                        {exercise.instructions && (
                          <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Instructions
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {exercise.instructions}
                            </p>
                          </div>
                        )}

                        {exercise.notes && (
                          <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">
                            <p className="text-xs font-semibold text-amber-200">
                              Note
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              {exercise.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-center">
                  <p className="font-semibold text-amber-200">
                    No exercises were confidently extracted.
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Check the document or try a clearer PDF or image.
                  </p>
                </div>
              )}
            </div>

            {(extractedHEP.frequency.rawText ||
              extractedHEP.frequency.sessionsPerWeek !== null ||
              (extractedHEP.frequency.specifiedDays &&
                extractedHEP.frequency.specifiedDays.length > 0)) && (
              <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Plan frequency
                </p>

                {extractedHEP.frequency.rawText && (
                  <p className="mt-3 text-sm text-slate-300">
                    {extractedHEP.frequency.rawText}
                  </p>
                )}

                {extractedHEP.frequency.sessionsPerWeek !== null && (
                  <p className="mt-2 text-sm text-slate-400">
                    Extracted frequency:{" "}
                    {extractedHEP.frequency.sessionsPerWeek} sessions per
                    week
                  </p>
                )}

                {extractedHEP.frequency.specifiedDays &&
                  extractedHEP.frequency.specifiedDays.length > 0 && (
                    <p className="mt-2 text-sm text-slate-400">
                      Days:{" "}
                      {extractedHEP.frequency.specifiedDays.join(", ")}
                    </p>
                  )}
              </div>
            )}

            {extractedHEP.generalInstructions.length > 0 && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold">General instructions</h3>

                <ul className="mt-4 space-y-2">
                  {extractedHEP.generalInstructions.map(
                    (instruction, index) => (
                      <li
                        key={index}
                        className="flex gap-3 text-sm leading-6 text-slate-400"
                      >
                        <span className="text-indigo-300">•</span>
                        <span>{instruction}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {extractedHEP.extractionNotes.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
                <h3 className="font-bold text-amber-200">
                  Please double-check
                </h3>

                <ul className="mt-4 space-y-2">
                  {extractedHEP.extractionNotes.map((note, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm leading-6 text-slate-400"
                    >
                      <span className="text-amber-300">!</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.06] p-6 text-center">
              <h3 className="text-lg font-bold">
                Does this match your HEP?
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Compare the extracted information with your original
                document before continuing.
              </p>

              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setExtractedHEP(null);
                    chooseFile();
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  No, choose another file
                </button>

                <button
                  type="button"
                  onClick={() => {
                   if (!extractedHEP || !selectedFile) {
                    return;
          }

                   const confirmedPlan = {
                    id: crypto.randomUUID(),
                    sourceFileName: selectedFile.name,
                    uploadedAt: new Date().toISOString(),
                    exercises: extractedHEP.exercises,
                    frequency: extractedHEP.frequency,
                    generalInstructions: extractedHEP.generalInstructions,
                    extractionNotes: extractedHEP.extractionNotes,
                    confirmed: true,
         };

         sessionStorage.setItem(
          "rehabverse-confirmed-hep",
          JSON.stringify(confirmedPlan)
       );

       router.push("/quest");
     }}
     className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
>
  Yes, Confirm My HEP →
</button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Confirm only after comparing the extracted details with your original HEP.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}