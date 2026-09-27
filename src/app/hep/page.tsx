"use client";

import Link from "next/link";
import { confirmPlanReplacement } from "@/lib/scheduleStorage";
import { useConfirmedPlan, useLocalDataStatus } from "@/hooks/useProgress";
import HEPSchedule from "@/components/HEPSchedule";
import HEPExerciseEditor from "@/components/HEPExerciseEditor";
import { createHEPReview, selectedHEP, reviewValid, type ReviewExercise } from "@/lib/hepReview";
import PlanUpdateReview from "@/components/PlanUpdateReview";
import { isExtractedHEP } from "@/lib/validateHEP";
import type { ExtractedHEP } from "@/types/schedule";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type AnalyzeResponse = {
  success?: boolean;
  fileName?: string;
  extractedHEP?: ExtractedHEP;
  error?: string;
};

export default function HEPPage() {
  const router = useRouter();
  const savedPlan = useConfirmedPlan();
  const dataStatus = useLocalDataStatus();
  const analysisRef = useRef<AbortController | null>(null);
  useEffect(() => () => { analysisRef.current?.abort(); analysisRef.current = null; }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [fileError, setFileError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedHEP, setExtractedHEP] = useState<ExtractedHEP | null>(
    null
  );

  const [review, setReview] = useState<ReviewExercise[]>([]);
  const reviewedHEP = extractedHEP ? selectedHEP(extractedHEP, review) : null;
  const canConfirm = reviewValid(review);

  function confirmHEP() {
    if (!extractedHEP || !reviewedHEP || !canConfirm || !selectedFile || savingRef.current || dataStatus !== "ready") return;
    savingRef.current = true;
    setIsSaving(true);
    setConfirmationError("");
    try {
      confirmPlanReplacement({
        ...reviewedHEP,
        originalExtraction: extractedHEP,
        id: crypto.randomUUID(),
        sourceFileName: selectedFile.name,
        uploadedAt: new Date().toISOString(),
        confirmed: true,
      }, savedPlan?.id ?? null);
      router.push("/quest");
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : "Could not save your plan. Please allow browser storage and try again.");
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (analysisRef.current || savingRef.current) return;
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileError("");
    setAnalysisError("");
    setExtractedHEP(null);
    setConfirmationError("");

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

    if (file.size === 0) {
      setSelectedFile(null);
      setFileError("This file is empty. Choose another PDF or image.");
      event.target.value = "";
      return;
    }

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
    if (!analysisRef.current && !savingRef.current) fileInputRef.current?.click();
  }

  function removeFile() {
    setSelectedFile(null);
    setFileError("");
    setAnalysisError("");
    setExtractedHEP(null);
    setConfirmationError("");

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
    if (!selectedFile || analysisRef.current || savingRef.current) {
      return;
    }

    const controller = new AbortController();
    analysisRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    setIsAnalyzing(true);
    setAnalysisError("");
    setExtractedHEP(null);
    setConfirmationError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/hep/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data: AnalyzeResponse = await response.json().catch(() => ({ error: "The document reader is unavailable. Try again in a moment." }));
      if (analysisRef.current !== controller) return;

      if (!response.ok || !data.success || !isExtractedHEP(data.extractedHEP)) {
        throw new Error(
          data.error || "RehabVerse could not analyze this HEP."
        );
      }

      setExtractedHEP(data.extractedHEP);
      setReview(createHEPReview(data.extractedHEP));

      window.setTimeout(() => {
        const review = document.getElementById("hep-review");
        review?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        });
        review?.focus({ preventScroll: true });
      }, 100);
    } catch (error) {
      if (analysisRef.current !== controller) return;

      setAnalysisError(
        controller.signal.aborted ? "Reading took too long. Try again with a clearer or smaller file. Your current plan is unchanged." : error instanceof Error
          ? error.message
          : "RehabVerse could not analyze this HEP."
      );
    } finally {
      window.clearTimeout(timeout);
      if (analysisRef.current === controller) {
        analysisRef.current = null;
        setIsAnalyzing(false);
      }
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to RehabVerse
          </Link>

          <div className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-xs font-medium text-indigo-200">
            My HEP
          </div>
          <Link href="/progress" className="text-sm text-cyan-200">My Progress →</Link>
        </nav>

        {dataStatus !== "ready" && <p role="status" className="mb-6 rounded-xl border border-indigo-300/20 p-4 text-sm text-slate-300">{dataStatus === "loading" ? "Loading your saved plan…" : "Browser storage is unavailable. Enable it to confirm or update a plan. Your uploaded file can still be reviewed."}</p>}

        {savedPlan && <>
          <HEPSchedule plan={savedPlan} />
          <section className="mb-10 flex flex-col justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-6 sm:flex-row sm:items-center">
            <div><h2 className="font-semibold">Back from a visit with an updated plan?</h2><p className="mt-2 text-sm text-slate-300">Compare your new HEP with {savedPlan.sourceFileName}. Your current plan stays active until you confirm.</p></div>
            <button onClick={chooseFile} disabled={isAnalyzing || isSaving} className="shrink-0 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold disabled:opacity-40">Upload Updated HEP</button>
          </section>
        </>}

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

        <section aria-busy={isAnalyzing} className="mx-auto mt-12 max-w-3xl">
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
                  aria-label="Upload your Home Exercise Program PDF or image"
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
                  {savedPlan ? "Upload Updated HEP" : "Choose HEP File"}
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
                    disabled={isAnalyzing || isSaving}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Choose Different File
                  </button>

                  <button
                    type="button"
                    onClick={analyzeHEP}
                    disabled={isAnalyzing || isSaving}
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

                {!isAnalyzing && !isSaving && (
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
                  aria-label="Upload your Home Exercise Program PDF or image"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}

            {isAnalyzing && <p role="status" className="mt-5 text-sm leading-6 text-indigo-200">Reading your document. This can take up to a minute. You will review the results before your plan changes.</p>}

            {fileError && (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
                <p role="alert" className="text-sm text-red-300">{fileError}</p>
              </div>
            )}

            {analysisError && (
              <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
                <p className="font-semibold text-red-300">
                  Could not read this HEP
                </p>

                <p role="alert" className="mt-1 text-sm text-red-200">
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

        {extractedHEP && reviewedHEP && selectedFile && <>
          <HEPExerciseEditor original={extractedHEP} review={review} onChange={setReview} disabled={isSaving} />
          {!canConfirm && <p className="mx-auto mt-5 max-w-5xl text-sm text-amber-200">Select at least one exercise. Selected entries need a name; supplied counts must be positive whole numbers. Unspecified dosage can stay blank.</p>}
          {savedPlan ? <PlanUpdateReview currentPlan={savedPlan} extracted={reviewedHEP} sourceFileName={selectedFile.name} onConfirm={confirmHEP} onCancel={removeFile} error={confirmationError} saving={isSaving} storageAvailable={dataStatus === "ready" && canConfirm} /> : <section className="mx-auto my-8 max-w-5xl rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-6">
            <p className="text-sm text-slate-300">Only your selected, corrected entries will appear in My HEP. Missing dosage stays missing; RehabVerse does not prescribe it.</p>
            <div className="mt-5 flex flex-wrap gap-3"><button onClick={confirmHEP} disabled={isSaving || dataStatus !== "ready" || !canConfirm} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold disabled:opacity-40">{isSaving ? "Saving…" : "Confirm My HEP"}</button><button onClick={removeFile} disabled={isSaving} className="rounded-xl border border-white/20 px-5 py-3">Choose another file</button></div>
            {confirmationError && <p role="alert" className="mt-3 text-rose-200">{confirmationError}</p>}
          </section>}
        </>}
      </div>
    </main>
  );
}
