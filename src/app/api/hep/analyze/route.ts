import { GoogleGenAI, Type } from "@google/genai";
import { isExtractedHEP } from "@/lib/validateHEP";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
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

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

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
10. This extraction will be shown to the user for verification before
    it is used by RehabVerse.

Carefully inspect the entire uploaded document and return only the
structured information requested by the response schema.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: hepSchema,
        temperature: 0,
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const extractedHEP: unknown = JSON.parse(response.text);
    if (!isExtractedHEP(extractedHEP)) {
      return NextResponse.json({ error: "The document reader returned incomplete data. Try a clearer PDF or image. Your current plan is unchanged." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      extractedHEP,
    });
  } catch {

    return NextResponse.json(
      {
        error:
          "RehabVerse could not analyze this HEP. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}