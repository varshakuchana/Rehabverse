import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { analyzeWithRetry } from "@/lib/analysisRetry";
import {
  analysisErrorCategory,
  analyzePDFWithFallback,
  parseHEPModelResponse,
  type HEPAnalysisCategory,
} from "@/lib/hepDocumentAnalysis";
import type { ExtractedHEP } from "@/types/schedule";
export const maxDuration = 120;

export const runtime = "nodejs";

const hepSchema = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      description:
        "Exercises explicitly present in the uploaded Home Exercise Program.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              "Exercise name exactly or as closely as possible to how it appears in the document.",
          },
          sets: {
            type: Type.INTEGER,
            nullable: true,
            description:
              "Number of sets explicitly stated in the document. Null if not provided.",
          },
          repetitions: {
            type: Type.INTEGER,
            nullable: true,
            description:
              "Number of repetitions explicitly stated in the document. Null if not provided.",
          },
          holdSeconds: {
            type: Type.NUMBER,
            nullable: true,
            description:
              "Hold duration in seconds if explicitly stated. Null if not provided.",
          },
          instructions: {
            type: Type.STRING,
            nullable: true,
            description:
              "Exercise instructions explicitly present in the document.",
          },
          notes: {
            type: Type.STRING,
            nullable: true,
            description:
              "Restrictions, precautions, or other notes explicitly associated with this exercise.",
          },
        },
        required: [
          "name",
          "sets",
          "repetitions",
          "holdSeconds",
          "instructions",
          "notes",
        ],
      },
    },

    frequency: {
      type: Type.OBJECT,
      properties: {
        sessionsPerWeek: {
          type: Type.INTEGER,
          nullable: true,
          description:
            "Number of sessions per week only if explicitly stated or directly calculable from the document.",
        },
        specifiedDays: {
          type: Type.ARRAY,
          nullable: true,
          items: {
            type: Type.STRING,
          },
          description:
            "Exact days specified by the document, if any.",
        },
        rawText: {
          type: Type.STRING,
          nullable: true,
          description:
            "The frequency wording from the document.",
        },
      },
      required: ["sessionsPerWeek", "specifiedDays", "rawText"],
    },

    generalInstructions: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description:
        "General instructions, precautions, or restrictions explicitly present in the document.",
    },

    extractionNotes: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description:
        "Important uncertainties in extraction. Use this to flag unclear, missing, or ambiguous information rather than guessing.",
    },
  },

  required: [
    "exercises",
    "frequency",
    "generalInstructions",
    "extractionNotes",
  ],
};

type LogDetails = Record<string, string | number | boolean | undefined>;
function upstreamStatus(error: unknown) {
  const value = error as { status?: number; code?: number | string };
  const status = value?.status ?? Number(value?.code);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}
function developmentLog(requestId: string, event: string, startedAt: number, details: LogDetails = {}) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[HEP analysis]", JSON.stringify({ requestId, event, elapsedMs: Date.now() - startedAt, ...details }));
}

function userError(category: HEPAnalysisCategory) {
  if (category === "rate_limit") return { status: 503, error: "The document reader is busy. Try again in a moment. Your current plan is unchanged." };
  if (category === "invalid_pdf") return { status: 400, error: "This PDF could not be opened. Export a new copy or upload clear images of the relevant pages." };
  if (category === "invalid_model_response" || category === "parsing_failure") return { status: 502, error: "The document reader returned incomplete information. Try again or upload clear images of the relevant pages. Your current plan is unchanged." };
  if (category === "network_upstream_failure") return { status: 503, error: "The document reader is temporarily unavailable. Try again in a moment. Your current plan is unchanged." };
  return { status: 504, error: "The document reader could not finish. Try again, or upload clear images of the relevant pages. Your current plan is unchanged." };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  developmentLog(requestId, "request_received", startedAt);
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "HEP reading is not configured on this demo yet. Please try again later; your current plan is unchanged.",
        },
        {
          status: 503,
        }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "No HEP file was provided.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported file type.",
        },
        {
          status: 400,
        }
      );
    }

    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          error: "The HEP file must be 10 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    if (file.size === 0) return NextResponse.json({ error: "This file is empty. Choose another PDF or image." }, { status: 400 });

    developmentLog(requestId, "file_validation", startedAt, { fileType: file.type, fileSize: file.size });
    const bytes = new Uint8Array(await file.arrayBuffer());

    const prompt = `
You are the document extraction component of RehabVerse.

The uploaded document is intended to be a Home Exercise Program (HEP)
or exercise instruction document.

Your task is ONLY to extract information that is explicitly present
in the uploaded document.

Extract:
- exercise names
- sets
- repetitions
- hold durations
- frequency
- explicitly stated exercise instructions
- explicitly stated precautions, restrictions, or notes

Critical rules:

1. Do NOT diagnose any condition.
2. Do NOT create a rehabilitation plan.
3. Do NOT recommend new exercises.
4. Do NOT change sets, repetitions, frequency, or hold durations.
5. Do NOT invent missing information.
6. If information is absent, return null where the schema allows it.
7. If wording or a value is unclear, preserve the uncertainty in
   extractionNotes instead of guessing.
8. Do not infer medical restrictions that are not explicitly written.
9. Keep exercise instructions faithful to the source document.
   Put only instructions tied to that specific exercise in exercise.instructions.
   Put warm-ups, program length, general stretching guidance, and general
   pain/safety guidance in generalInstructions, never inside every exercise.
10. Blank templates such as "Start at ____ reps" are missing values: return null, never zero or example values. A booklet listing exercises does not establish that all were assigned. Preserve selection instructions (such as "do highlighted exercises") and flag uncertain markings in extractionNotes.
11. This extraction will be shown to the user for verification before
    it is used by RehabVerse.

Carefully inspect the entire uploaded document and return only the
structured information requested by the response schema.
`;
    const analyzePart = async (
      partBytes: Uint8Array,
      signal: AbortSignal,
      context: { kind: "whole" | "batch"; pageCount: number; batch?: { startPage: number; endPage: number; index: number; total: number }; attempt: number },
    ): Promise<ExtractedHEP> => {
      const label = context.kind === "batch" ? `pages ${context.batch!.startPage}-${context.batch!.endPage}` : "whole document";
      const callStarted = Date.now();
      developmentLog(requestId, "gemini_request_start", startedAt, { label, attempt: context.attempt + 1, bytes: partBytes.byteLength });
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{
            role: "user",
            parts: [
              { text: `${prompt}\n${context.kind === "batch" ? `This file contains only ${label} of a ${context.pageCount}-page document. Extract only what is visible in these pages; do not infer content from omitted pages.` : ""}` },
              { inlineData: { mimeType: file.type, data: Buffer.from(partBytes).toString("base64") } },
            ],
          }],
          config: {
            abortSignal: signal,
            httpOptions: { timeout: context.kind === "batch" ? 45000 : 40000, retryOptions: { attempts: 1 } },
            responseMimeType: "application/json",
            responseSchema: hepSchema,
            temperature: 0,
          },
        });
      } catch (error) {
        developmentLog(requestId, "gemini_request_end", startedAt, { label, attempt: context.attempt + 1, durationMs: Date.now() - callStarted, success: false, category: analysisErrorCategory(error), status: upstreamStatus(error) });
        throw error;
      }
      developmentLog(requestId, "gemini_request_end", startedAt, { label, attempt: context.attempt + 1, durationMs: Date.now() - callStarted, success: true });
      const parseStarted = Date.now();
      try {
        const parsed = parseHEPModelResponse(response.text);
        developmentLog(requestId, "parse_validation", startedAt, { label, durationMs: Date.now() - parseStarted, success: true, exerciseCount: parsed.exercises.length });
        return parsed;
      } catch (error) {
        developmentLog(requestId, "parse_validation", startedAt, { label, durationMs: Date.now() - parseStarted, success: false, category: analysisErrorCategory(error) });
        throw error;
      }
    };

    let extractedHEP: ExtractedHEP;
    if (file.type === "application/pdf") {
      const result = await analyzePDFWithFallback({
        bytes,
        signal: request.signal,
        analyzePart,
        concurrency: 1,
        onEvent: event => {
          if (event.type === "pdf_ready") developmentLog(requestId, "pdf_inspection", startedAt, { pageCount: event.pageCount, batchCount: event.batchCount });
          if (event.type === "fallback") developmentLog(requestId, "batched_fallback", startedAt, { pageCount: event.pageCount, category: event.category });
          if (event.type === "whole_attempt" && event.attempt > 0) developmentLog(requestId, event.state === "start" ? "retry_start" : "retry_end", startedAt, {
            label: "whole document",
            attempt: event.attempt + 1,
            success: event.state === "success" ? true : event.state === "failure" ? false : undefined,
            category: event.category,
          });
          if (event.type === "batch_attempt" && event.attempt > 0) developmentLog(requestId, event.state === "start" ? "retry_start" : "retry_end", startedAt, {
            batch: event.batch.index + 1,
            batchCount: event.batch.total,
            pages: `${event.batch.startPage}-${event.batch.endPage}`,
            success: event.state === "success" ? true : event.state === "failure" ? false : undefined,
            category: event.category,
          });
        },
      });
      extractedHEP = result.extractedHEP;
      developmentLog(requestId, "analysis_complete", startedAt, { pageCount: result.pageCount, usedBatches: result.usedBatches, exerciseCount: extractedHEP.exercises.length });
    } else {
      extractedHEP = await analyzeWithRetry(
        (signal, attempt) => analyzePart(bytes, signal, { kind: "whole", pageCount: 1, attempt }),
        request.signal,
        45000,
        2,
        (state, attempt, error) => {
          if (attempt > 0) developmentLog(requestId, state === "start" ? "retry_start" : "retry_end", startedAt, { attempt: attempt + 1, success: state === "success" ? true : state === "failure" ? false : undefined, category: error ? analysisErrorCategory(error) : undefined });
        },
      );
    }

    developmentLog(requestId, "total_duration", startedAt, { success: true, exerciseCount: extractedHEP.exercises.length });
    return NextResponse.json({
      success: true,
      fileName: file.name,
      extractedHEP,
    });
  } catch (error) {
    const category = analysisErrorCategory(error);
    developmentLog(requestId, "total_duration", startedAt, { success: false, category, status: upstreamStatus(error) });
    const response = userError(category);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
