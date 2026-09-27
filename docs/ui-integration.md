# UI integration architecture comparison

The Desktop RehabVerse is authoritative. The Downloads teammate project is a visual source only. Comparison completed before application edits.

## Current-only components and capabilities

- `ExerciseInstructor`, `NovaVoiceControl`, `QuestExperience`, `TrackedQuest`, `RehabWorldGame` and its CSS.
- `HEPExerciseEditor`, `PlanUpdateReview`, `HEPSchedule`, `hepReview`, `hepQuests`: editable review, inclusion/exclusion, current comparison and conservative quest mapping.
- `ExploreNovaCreator`, `/api/explore`, `/explore/quest`, `exploreSafety`, `exerciseCatalog`, `exploreQuest`, `exploreQuestStorage`: Gemini safety routing and approved-library validation.
- `movementDetectors`: shared knee, shoulder flexion and selected-side shoulder abduction measurements.
- Core regression script. Current Gemini extraction, scheduling, history, speech start, ElevenLabs and storage remain authoritative even where both projects contain similarly named files.

## Teammate-only components

- `rehabWorld/engine.ts`: floating island, five restoration zones, camera utilities, particles and energy effects.
- `rehabWorld/worlds.ts`: separate well/flock/cairn/orbit scene engine; `sound.ts`: synthesized audio.
- `IslandBackdrop`, `RehabWorld`, `SiteNav`, `NovaToggle`, `QuestIntro`, `DemoFigure`, `SessionComplete`, `WeekCard`.
- `/session/[id]`, `/session/guided`, `/dev/world`, `movements.ts`, `exerciseMatch.ts`.

## Competing responsibilities and decisions

| Responsibility | Current authority | Teammate alternative / decision |
| --- | --- | --- |
| Detection / sessions | movementDetectors, MovementAttemptEngine, TrackedQuest, QuestExperience, GuidedQuest | Do not import movements, dynamic session pages or replacement squat/GuidedQuest. Teammate averages shoulder sides and introduces balance timing. |
| HEP capability / dose | hepReview, hepQuests, exerciseCatalog | Do not import exerciseMatch; broad name matching and default balance doses conflict with current routing. |
| HEP review / comparison | current HEP page, editor, PlanUpdateReview | Keep current pages and API route; teammate page lacks current review architecture. |
| Explore | current creator, safety API and quest storage | Keep current routes/data; teammate Explore is primarily a static game selector. |
| Progress / schedule | current storage, hooks, types, HEPSchedule | Do not import WeekCard or storage/schema changes. SessionComplete adds feeling, duration and range fields. |
| Game presentation | RehabWorldGame consuming existing state | Adapt island engine beneath it; preserve SVG fallback, accessible progress and completion semantics. Do not mount teammate RehabWorld orchestration. |
| Tutorials / Nova | ExerciseInstructor and NovaVoiceControl | Reuse QuestIntro's glass treatment, larger typography and NovaMark SVG; retain instructions, side selection and speech gating. |
| Navigation | existing routes | Adapt SiteNav across main pages; preserve page actions. |

## Integration boundary

The island renderer receives completed movements, target, and a boolean phase cue. It cannot detect, count, start, complete, save or route a session. Energy is a decorative phase cue, never movement depth or a new threshold. Restoration comes only from existing completed counts. There is no persistence or clinical interpretation in the renderer.

Use one Three.js engine, lazy loaded on the client. Keep the existing garden on import/WebGL/context failure and reduced-motion preference. Dispose GPU resources, animation frames, observers and event listeners when leaving a page. Resets cancel pending effects. No new story mode, unlocks, quest database, sound engine or session architecture.

## Manual verification

- HEP upload → edit/exclude → compare → confirm → schedule; confirm excluded exercises stay excluded.
- Nova Explore accepted/rejected prompts and approved exercises; complete a multi-exercise quest.
- Knee and both shoulder detectors, selected arm, camera denial/loss, Start/Begin, countdown and replay.
- Guided mark/pause/resume/explicit completion; no early completion at the target count.
- Saved history, save failure/retry and Continue gating; Nova voice interruption and toggle.
- Island restoration, rapid rep updates, replay during effects, navigation cleanup, mobile sizing, WebGL/context loss, reduced motion and background tabs.

## Delivered files and validation

- Ported/adapted `lib/rehabWorld/engine.ts`, `SiteNav.tsx`, and NovaMark from `NovaToggle.tsx`.
- `IslandPresentation.tsx` adapts IslandBackdrop's lifecycle/background and injects the island into the existing RehabWorldGame. Home uses a decorative backdrop with no saved-progress claims.
- Adapted QuestIntro glass, display sizing and primary button in ExerciseInstructor; retained Geist to avoid introducing another font download. Added scoped shared tokens in globals.css.
- Main-page navigation consolidated into SiteNav. No movement, storage or quest systems duplicated. SVG and Three.js are alternative renderers of the same state.
- Did not import `worlds.ts`, `sound.ts`, full RehabWorld, QuestIntro, DemoFigure, SessionComplete or NovaToggle. The second engine is unnecessary, audio would compete with Nova, demo/theme instructions do not match every authoritative exercise, and teammate completion assumes additional storage fields. Current completion UI and save/retry/Continue behavior remain intact.
- `npm run lint`: passed without warnings.
- `npx tsc --noEmit`: passed.
- `npm run check:core`: all 13 checks passed.
- `npm run build`: passed, all existing application routes generated.
- `node scripts/check-presentation.mjs`: three visual lifecycle checks passed (late arrivals, replay cleanup, repeat cleanup).
- Browser/GPU, real camera, microphone and live Gemini/ElevenLabs calls require the manual verification listed above; these were not exercised by the command-line checks.
