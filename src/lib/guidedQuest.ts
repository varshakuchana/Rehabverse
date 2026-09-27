export type GuidedQuestState = {
  phase: "tutorial" | "ready" | "active" | "paused" | "complete";
  reps: number;
  sessionId: string | null;
};
export const initialGuidedState: GuidedQuestState = { phase: "tutorial", reps: 0, sessionId: null };
export type GuidedAction =
  | { type: "ready" | "pause" | "resume" | "reset" }
  | { type: "start"; id: string }
  | { type: "mark" | "complete"; target: number };
export function guidedQuestReducer(state: GuidedQuestState, action: GuidedAction): GuidedQuestState {
  switch (action.type) {
    case "ready": return state.phase === "tutorial" ? { ...state, phase: "ready" } : state;
    case "start": return state.phase === "ready" ? { ...state, phase: "active", sessionId: action.id } : state;
    case "mark": return state.phase === "active" && state.reps < action.target ? { ...state, reps: state.reps + 1 } : state;
    case "pause": return state.phase === "active" ? { ...state, phase: "paused" } : state;
    case "resume": return state.phase === "paused" ? { ...state, phase: "active" } : state;
    case "complete": return state.phase === "active" && state.reps === action.target ? { ...state, phase: "complete" } : state;
    case "reset": return { ...initialGuidedState, phase: "ready" };
  }
}
