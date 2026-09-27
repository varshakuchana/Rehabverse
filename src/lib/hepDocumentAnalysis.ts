import { PDFDocument } from "pdf-lib";
import { normalizeTemplateFields, separatePlanGuidance, templateText } from "./hepReview";
import { isExtractedHEP } from "./validateHEP";
import { analyzeWithRetry, busyAnalysisError, transientAnalysisError } from "./analysisRetry";
import type { ConfirmedExercise, ExtractedHEP, Frequency } from "@/types/schedule";

export const PDF_BATCH_SIZE = 4;
export const LONG_PDF_PAGE_THRESHOLD = 8;

export type HEPAnalysisCategory =
  | "gemini_timeout"
  | "rate_limit"
  | "invalid_model_response"
  | "parsing_failure"
  | "network_upstream_failure"
  | "invalid_pdf"
  | "long_document_complexity"
  | "unknown";

export class HEPAnalysisError extends Error {
  constructor(public readonly category: HEPAnalysisCategory, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HEPAnalysisError";
  }
}

export function analysisErrorCategory(error: unknown): HEPAnalysisCategory {
  if (error instanceof HEPAnalysisError) return error.category;
  const value = error as { name?: string; message?: string; status?: number; code?: number | string };
  if (value?.status === 429 || value?.code === 429 || /resource[_ ]exhausted|too many requests/i.test(value?.message ?? "")) return "rate_limit";
  if (value?.status === 408 || value?.code === 408) return "gemini_timeout";
  if (typeof value?.status === "number" && value.status >= 500) return "network_upstream_failure";
  if (["AbortError", "TimeoutError"].includes(value?.name ?? "") || /timed? ?out|deadline/i.test(value?.message ?? "")) return "gemini_timeout";
  if (error instanceof SyntaxError) return "parsing_failure";
  if (/fetch failed|network|socket|upstream|econn/i.test(value?.message ?? "")) return "network_upstream_failure";
  return "unknown";
}

export function parseHEPModelResponse(text: string | undefined): ExtractedHEP {
  if (!text) throw new HEPAnalysisError("invalid_model_response", "The model returned an empty response.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (cause) { throw new HEPAnalysisError("parsing_failure", "The model response was not valid JSON.", { cause }); }
  const normalized = normalizeTemplateFields(parsed);
  if (!isExtractedHEP(normalized)) throw new HEPAnalysisError("invalid_model_response", "The model response did not match the HEP schema.");
  if (templateText(normalized.frequency.rawText)) {
    normalized.frequency = { sessionsPerWeek: null, specifiedDays: null, rawText: null };
  }
  return separatePlanGuidance(normalized);
}

function normalizedText(value: string | null | undefined) {
  return value?.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? "";
}

function compatibleValue<T>(left: T | null | undefined, right: T | null | undefined) {
  return left == null || right == null || left === right;
}

function compatibleExercise(left: ConfirmedExercise, right: ConfirmedExercise) {
  return normalizedText(left.name) === normalizedText(right.name) &&
    compatibleValue(left.sets, right.sets) &&
    compatibleValue(left.repetitions, right.repetitions) &&
    compatibleValue(left.holdSeconds, right.holdSeconds) &&
    (!left.instructions || !right.instructions || normalizedText(left.instructions) === normalizedText(right.instructions)) &&
    (!left.notes || !right.notes || normalizedText(left.notes) === normalizedText(right.notes));
}

function mergeExercise(left: ConfirmedExercise, right: ConfirmedExercise): ConfirmedExercise {
  return {
    name: left.name,
    sets: left.sets ?? right.sets ?? null,
    repetitions: left.repetitions ?? right.repetitions ?? null,
    holdSeconds: left.holdSeconds ?? right.holdSeconds ?? null,
    instructions: left.instructions || right.instructions || null,
    notes: left.notes || right.notes || null,
  };
}

function uniqueText(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return values.flatMap(value => {
    const key = normalizedText(value);
    if (!value?.trim() || !key || seen.has(key) || templateText(value)) return [];
    seen.add(key);
    return [value.trim()];
  });
}

function mergeFrequency(frequencies: Frequency[], notes: string[]): Frequency {
  const numeric = [...new Set(frequencies.flatMap(item => Number.isSafeInteger(item.sessionsPerWeek) && item.sessionsPerWeek! > 0 ? [item.sessionsPerWeek!] : []))];
  const raw = uniqueText(frequencies.map(item => item.rawText));
  const daySets = frequencies.flatMap(item => Array.isArray(item.specifiedDays) ? item.specifiedDays : []);
  const days = uniqueText(daySets);
  if (numeric.length > 1 || raw.length > 1) notes.push("Frequency wording differs across document sections; review the source before confirming a schedule.");
  return {
    sessionsPerWeek: numeric.length === 1 ? numeric[0] : null,
    specifiedDays: days.length ? days : null,
    // Preserve explicit source wording without synthesizing a new instruction.
    rawText: raw.length === 1 ? raw[0] : null,
  };
}

export function mergeExtractedHEPs(results: ExtractedHEP[]): ExtractedHEP {
  const exercises: ConfirmedExercise[] = [];
  for (const result of results) {
    for (const candidate of result.exercises) {
      const existing = exercises.findIndex(item => compatibleExercise(item, candidate));
      if (existing === -1) exercises.push({ ...candidate });
      else exercises[existing] = mergeExercise(exercises[existing], candidate);
    }
  }
  const extractionNotes = uniqueText(results.flatMap(result => result.extractionNotes));
  return {
    exercises,
    frequency: mergeFrequency(results.map(result => result.frequency), extractionNotes),
    generalInstructions: uniqueText(results.flatMap(result => result.generalInstructions)),
    extractionNotes: uniqueText(extractionNotes),
  };
}

export type PDFBatch = { bytes: Uint8Array; startPage: number; endPage: number; index: number; total: number };

export async function splitPDF(bytes: Uint8Array, batchSize = PDF_BATCH_SIZE): Promise<{ pageCount: number; batches: PDFBatch[] }> {
  let source: PDFDocument;
  try { source = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (cause) { throw new HEPAnalysisError("invalid_pdf", "The PDF could not be opened.", { cause }); }
  const pageCount = source.getPageCount();
  if (!pageCount) throw new HEPAnalysisError("invalid_pdf", "The PDF has no pages.");
  const total = Math.ceil(pageCount / batchSize);
  const batches: PDFBatch[] = [];
  for (let start = 0; start < pageCount; start += batchSize) {
    const end = Math.min(start + batchSize, pageCount);
    const target = await PDFDocument.create();
    const pages = await target.copyPages(source, Array.from({ length: end - start }, (_, offset) => start + offset));
    pages.forEach(page => target.addPage(page));
    batches.push({ bytes: await target.save(), startPage: start + 1, endPage: end, index: batches.length, total });
  }
  return { pageCount, batches };
}

type PartContext = { kind: "whole" | "batch"; pageCount: number; batch?: PDFBatch; attempt: number };
type AnalyzePart = (bytes: Uint8Array, signal: AbortSignal, context: PartContext) => Promise<ExtractedHEP>;
type AnalysisEvent =
  | { type: "pdf_ready"; pageCount: number; batchCount: number }
  | { type: "fallback"; pageCount: number; category: HEPAnalysisCategory }
  | { type: "whole_attempt"; attempt: number; state: "start" | "success" | "failure"; category?: HEPAnalysisCategory }
  | { type: "batch_attempt"; batch: PDFBatch; attempt: number; state: "start" | "success" | "failure"; category?: HEPAnalysisCategory };

export async function analyzePDFWithFallback({
  bytes,
  signal,
  analyzePart,
  batchSize = PDF_BATCH_SIZE,
  longPageThreshold = LONG_PDF_PAGE_THRESHOLD,
  wholeTimeout = 40000,
  batchTimeout = 45000,
  concurrency = 1,
  onEvent,
}: {
  bytes: Uint8Array;
  signal: AbortSignal;
  analyzePart: AnalyzePart;
  batchSize?: number;
  longPageThreshold?: number;
  wholeTimeout?: number;
  batchTimeout?: number;
  concurrency?: number;
  onEvent?: (event: AnalysisEvent) => void;
}): Promise<{ extractedHEP: ExtractedHEP; pageCount: number; usedBatches: boolean }> {
  const split = await splitPDF(bytes, batchSize);
  onEvent?.({ type: "pdf_ready", pageCount: split.pageCount, batchCount: split.batches.length });
  if (split.pageCount <= longPageThreshold) {
    try {
      const extractedHEP = await analyzeWithRetry(
        (deadlineSignal, attempt) => analyzePart(bytes, deadlineSignal, { kind: "whole", pageCount: split.pageCount, attempt }),
        signal,
        wholeTimeout,
        2,
        (state, attempt, error) => onEvent?.({ type: "whole_attempt", attempt, state, category: error ? analysisErrorCategory(error) : undefined }),
        { shouldRetry: busyAnalysisError },
      );
      return { extractedHEP, pageCount: split.pageCount, usedBatches: false };
    } catch (error) {
      const category = analysisErrorCategory(error);
      if (signal.aborted || split.pageCount === 1 || !["gemini_timeout", "invalid_model_response", "parsing_failure"].includes(category)) throw error;
      onEvent?.({ type: "fallback", pageCount: split.pageCount, category });
    }
  } else {
    onEvent?.({ type: "fallback", pageCount: split.pageCount, category: "long_document_complexity" });
  }

  const results = new Array<ExtractedHEP>(split.batches.length);
  const analysisController = new AbortController();
  const cancel = () => analysisController.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  let nextBatch = 0;
  const worker = async () => {
    while (nextBatch < split.batches.length) {
      const batch = split.batches[nextBatch++];
      results[batch.index] = await analyzeWithRetry(
        (deadlineSignal, attempt) => analyzePart(batch.bytes, deadlineSignal, { kind: "batch", pageCount: split.pageCount, batch, attempt }),
        analysisController.signal,
        batchTimeout,
        2,
        (state, attempt, error) => onEvent?.({ type: "batch_attempt", batch, attempt, state, category: error ? analysisErrorCategory(error) : undefined }),
      );
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), split.batches.length) }, worker));
    return { extractedHEP: mergeExtractedHEPs(results), pageCount: split.pageCount, usedBatches: true };
  } catch (error) {
    analysisController.abort(error);
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

export function shouldRetryBatch(error: unknown) {
  return transientAnalysisError(error);
}
