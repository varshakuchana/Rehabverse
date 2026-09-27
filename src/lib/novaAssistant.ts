export type NovaContext = {
  route: string; mode?: string; exercise?: string; instructions?: string;
  target?: number; completed?: number; sessionState?: string; trackingReady?: boolean;
  cameraEnabled?: boolean; missingLandmarks?: string; sourceName?: string; summary?: string;
};
export type NovaAnswer = { text: string; href?: string; action?: "reset" };
export const MEDICAL_ANSWER = "I can help you follow or understand an existing care plan, but I can't choose treatment exercises for pain or change your dosage. If you already have a Home Exercise Program, I can help turn it into a quest.";
export function medicalQuestion(text: string) {
  return /\b(pain\w*|hurts?|injur\w*|diagnos\w*|treat\w*|heal\w*|prescrib\w*|swelling|numb\w*|surger\w*|arthritis|sciatica|torn|fractur\w*|sprain\w*|stroke|acl|meniscus|tingl\w*|post[ -]?op|recover\w*|sore|aching)\b/i.test(text) || /(?:change|increase|decrease|more|fewer).*(?:dose|reps|repetitions)|push.*(?:harder|farther)/i.test(text);
}
export function safeNovaContext(value: unknown): NovaContext {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const out: NovaContext = { route: "/" };
  for (const key of ["route", "mode", "exercise", "instructions", "sessionState", "missingLandmarks", "sourceName", "summary"] as const) {
    if (typeof input[key] === "string") out[key] = input[key].slice(0, key === "instructions" ? 2000 : 300);
  }
  for (const key of ["target", "completed"] as const) if (Number.isSafeInteger(input[key]) && (input[key] as number) >= 0) out[key] = input[key] as number;
  for (const key of ["trackingReady", "cameraEnabled"] as const) if (typeof input[key] === "boolean") out[key] = input[key];
  return out;
}
export function deterministicNova(question: string, context: NovaContext): NovaAnswer | null {
  const q = question.toLowerCase().trim().replace(/[?!.,]/g, "").replace(/\s+/g, " ");
  const routes = [["home", "/"], ["my hep|hep", "/hep"], ["my quest|quest", "/quest"], ["explore", "/explore"], ["story(?: mode)?", "/story"], ["progress", "/progress"]];
  for (const [name, href] of routes) {
    const command = `(?:(?:take|bring) me(?: to)?|go(?: to)?|open|show(?: me)?)`;
    const requested = new RegExp(`^(?:please )?(?:${command}(?: the)? (${name})(?: page)?|(?:the )?(${name}) page)(?: please)?$`).test(q);
    if (requested) return { text: `Opening ${href === "/" ? "Home" : href.slice(1)}.`, href };
  }
  if (medicalQuestion(q)) return { text: MEDICAL_ANSWER, href: undefined };
  const asksForInstructions = /\b(?:how (?:do|should|can) i do|how to do|explain(?: to me| me)?|instructions? for|show me how)\b/.test(q);
  if (asksForInstructions && context.mode === "HEP" && context.exercise) {
    const instructions = context.instructions?.trim();
    return instructions
      ? { text: `For ${context.exercise}, your confirmed HEP says: ${instructions}` }
      : { text: `Your confirmed HEP lists ${context.exercise}, but it doesn't include exercise-specific instructions. Check the source plan or ask your care team before continuing.` };
  }
  if (/^(?:start over|reset(?: session)?|restart(?: session)?)$/.test(q)) return context.sessionState ? { text: "Starting this session over. Saved progress stays saved.", action: "reset" } : { text: "Open a quest to start a session." };
  if (/how many.*(?:done|completed)|completed reps/.test(q)) return { text: context.completed !== undefined ? `${context.completed} movements completed in this session.` : "There is no active movement count on this page." };
  if (/how many.*(?:left|remain)|remaining reps/.test(q)) return { text: context.target !== undefined && context.completed !== undefined ? `${Math.max(0, context.target - context.completed)} movements left (${context.completed} of ${context.target} completed).` : "There is no active movement count on this page." };
  if (/what exercise (?:am i|is this)|what am i doing/.test(q)) return { text: context.exercise ? `You're doing ${context.exercise}.` : "No exercise is active on this page." };
  if (/camera.*(?:on|off|enabled)/.test(q)) return { text: context.cameraEnabled === undefined ? "No session camera is active on this page." : `Your camera is ${context.cameraEnabled ? "on" : "off"}.` };
  if (/why.*(?:see me|tracking)|can(?:not|'t) see me/.test(q)) return { text: !context.cameraEnabled ? "Enable your session camera first." : context.trackingReady ? "Your required landmarks are visible and tracking is ready." : `Tracking is waiting for a clear view. ${context.missingLandmarks || "Follow the camera positioning instructions and keep your moving side visible."}` };
  return null;
}
export function validateNovaAnswer(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => key !== "text") || typeof v.text !== "string") return null;
  const text = v.text.trim();
  if (!text || text.length > 1200 || /https?:|<[^>]+>|\b(?:api[_ -]?key|system prompt)\b/i.test(text)) return null;
  if (/(?:push|move|stretch) (?:harder|farther)|\byou (?:have|probably have)\b|\b(?:increase|decrease|double) (?:your )?(?:reps|dosage|sets)\b/i.test(text)) return null;
  return text;
}

export function safeNovaHistory(value: unknown): { role: "user" | "model"; parts: { text: string }[] }[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap(item => item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string"
    ? [{ role: item.role === "user" ? "user" as const : "model" as const, parts: [{ text: item.text.slice(0, 1200) }] }] : []);
}
