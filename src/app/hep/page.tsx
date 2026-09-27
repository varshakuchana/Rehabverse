"use client";

import SiteNav from "@/components/SiteNav";
import { confirmPlanReplacement } from "@/lib/scheduleStorage";
import { useConfirmedPlan, useLocalDataStatus } from "@/hooks/useProgress";
import HEPSchedule from "@/components/HEPSchedule";
import HEPExerciseEditor from "@/components/HEPExerciseEditor";
import IslandPresentation from "@/components/IslandPresentation";
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
    <main id="main-content" tabIndex={-1} className="rv-home rv-scene relative isolate min-h-screen overflow-hidden bg-[linear-gradient(180deg,#1E2240_0%,#2B2B52_60%,#3A3160_100%)] px-6 py-6">
      {!extractedHEP && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-[-20%] w-[70%]"><IslandPresentation backdrop /></div>}
      <div className="relative z-10 mx-auto max-w-6xl">
        <SiteNav current="hep" />

        {dataStatus !== "ready" && <p role="status" className="rv-glass mb-6 rounded-2xl p-4 text-[15px]">{dataStatus === "loading" ? "Loading your saved plan…" : "Browser storage is unavailable. Enable it to confirm or update a plan. Your uploaded file can still be reviewed."}</p>}

        {savedPlan && <>
          <HEPSchedule plan={savedPlan} />
          <section className="rv-glass mb-10 flex flex-col justify-between gap-4 rounded-[24px] p-6 sm:flex-row sm:items-center">
            <div><h2 className="font-display text-2xl font-bold">Back from a visit with an updated plan?</h2><p className="mt-1 text-[16px] opacity-85">Compare your new HEP with {savedPlan.sourceFileName}. Your current plan stays active until you confirm.</p></div>
            <button onClick={chooseFile} disabled={isAnalyzing || isSaving} className="rv-btn rv-btn-primary shrink-0">Upload updated plan</button>
          </section>
        </>}

        <section className="max-w-3xl pt-4">
          <p className="rv-eyebrow">My HEP</p>
          <h1 className="mt-1 font-display text-[clamp(44px,6vw,80px)] font-extrabold leading-[.93] tracking-tight">
            {savedPlan ? "Your plan, updated" : "Upload your plan"}
          </h1>
          <p className="mt-4 max-w-[46ch] text-[19px] leading-snug opacity-90">
            The home exercise sheet your physical therapist gave you, as a PDF or a photo. You check everything RehabVerse reads before any of it is used.
          </p>
        </section>

        <section aria-busy={isAnalyzing} className="mt-8 max-w-3xl">
          <div
            className={`rounded-[28px] border-2 border-dashed p-9 text-center backdrop-blur-md transition ${
              selectedFile
                ? "border-[#F2C14E] bg-[rgba(24,28,54,.8)]"
                : "border-white/45 bg-[rgba(24,28,54,.6)]"
            }`}
          >
            {!selectedFile ? (
              <>
                <svg aria-hidden viewBox="0 0 64 64" className="mx-auto mb-4 h-16 w-16"><rect x="14" y="8" width="36" height="46" rx="4" fill="#EEF2F1" /><path d="M21 20h22M21 28h22M21 36h14" stroke="#4F5D68" strokeWidth="3" strokeLinecap="round" /><path d="M20 44h16" stroke="#F7DC86" strokeWidth="7" strokeLinecap="round" opacity=".9" /></svg>

                <h2 className="font-display text-2xl font-bold">
                  Drop in your exercise sheet
                </h2>

                <p className="mx-auto mt-2 max-w-lg text-[16px] leading-snug opacity-80">
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
                  className="rv-btn rv-btn-primary mt-6"
                >
                  {savedPlan ? "Upload updated plan" : "Choose a file"}
                </button>

                <p className="mt-3 text-[14px] opacity-65">
                  Supported: PDF, JPG, PNG, WEBP • Maximum 10 MB
                </p>
              </>
            ) : (
              <>
                <div aria-hidden className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#F2C14E] font-display text-2xl font-bold text-[#2A2410]">
                  ✓
                </div>

                <p className="rv-eyebrow">
                  File selected
                </p>

                <h2 className="mt-1 break-words font-display text-2xl font-bold">
                  {selectedFile.name}
                </h2>

                <div className="mt-2 flex items-center justify-center gap-3 text-[15px] opacity-75">
                  <span>
                    {selectedFile.type === "application/pdf"
                      ? "PDF document"
                      : "Image"}
                  </span>

                  <span>•</span>

                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>

                <p className="mx-auto mt-4 max-w-lg text-[16px] leading-snug opacity-80">
                  RehabVerse will extract the exercise information in this
                  document. You&apos;ll review the results before the plan is
                  used.
                </p>

                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={chooseFile}
                    disabled={isAnalyzing || isSaving}
                    className="rv-btn rv-btn-ghost"
                  >
                    Choose Different File
                  </button>

                  <button
                    type="button"
                    onClick={analyzeHEP}
                    disabled={isAnalyzing || isSaving}
                    className="rv-btn rv-btn-primary disabled:cursor-wait"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2A2410]/30 border-t-[#2A2410]" />
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
                    className="rv-link mt-4 text-[14px] opacity-75 hover:opacity-100"
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

            {isAnalyzing && <p role="status" className="rv-busy mt-5 text-[16px] leading-snug">Reading your document. This can take up to a minute. You will review the results before your plan changes.</p>}

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

          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {([["Upload", "The exercise plan you already have.", !!selectedFile], ["Check", "Pick your exercises and fix anything misread.", !!extractedHEP], ["Play", "Each exercise opens its own world.", false]] as const).map(([title, text, done], i) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-bold ${done ? "bg-[#F2C14E] text-[#2A2410]" : "border-2 border-white/40"}`}>{done ? "✓" : i + 1}</span>
                <div><h3 className="font-display text-lg font-bold">{title}</h3><p className="text-[15px] leading-snug opacity-80">{text}</p></div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="text-[15px] leading-snug opacity-85">
              <span className="font-semibold text-[#F2C14E]">
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
          {!canConfirm && <p className="mx-auto mt-5 max-w-5xl text-[15px] text-[#FFD89A]">Select at least one exercise. Selected entries need a name; supplied counts must be positive whole numbers. Unspecified dosage can stay blank.</p>}
          {savedPlan ? <PlanUpdateReview currentPlan={savedPlan} extracted={reviewedHEP} sourceFileName={selectedFile.name} onConfirm={confirmHEP} onCancel={removeFile} error={confirmationError} saving={isSaving} storageAvailable={dataStatus === "ready" && canConfirm} /> : <section className="sticky bottom-0 z-10 mx-auto my-8 max-w-5xl rounded-[24px] border-2 border-[#1F2A33] bg-[#EEF2F1] p-5 text-[#1F2A33] shadow-2xl">
            <p className="text-[15px]">Only your selected, corrected entries will appear in My HEP. Missing dosage stays missing; RehabVerse does not prescribe it.</p>
            <div className="mt-5 flex flex-wrap gap-3"><button onClick={confirmHEP} disabled={isSaving || dataStatus !== "ready" || !canConfirm} className="rv-btn rv-btn-moss">{isSaving ? "Saving…" : "Confirm my plan"}</button><button onClick={removeFile} disabled={isSaving} className="rv-btn">Choose another file</button></div>
            {confirmationError && <p role="alert" className="mt-3 text-[#A23B3B]">{confirmationError}</p>}
          </section>}
        </>}
      </div>
    </main>
  );
}
