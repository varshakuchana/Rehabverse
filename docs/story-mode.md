# RehabVerse: The Shattered Realms

## Product and route

`/story` contains the prologue, interactive island map, four-realm campaign and completion experience. Home and SiteNav expose Story Mode separately from My HEP, Explore and Progress. No additional session route or API is required. General movement game, not personalized medical treatment.

## Campaign

| Realm | Objectives | Actions | Reward |
| --- | --- | --- | --- |
| Sleeping Grove | Lumen Rise awakens five crystals and brightens the grove | 5 | Grove Fragment, Lumen Rise, Crystal Passage |
| Crystal Passage | Lumen Rise powers two pylons; Aether Wing opens the gate | 2 + 2 | Crystal Fragment, Aether Wing, Sky Ruins |
| Sky Ruins | Two visible light → wind → earth patterns | 3 + 3 | Sky Fragment, Terra Pulse, Motion Core |
| Motion Core | Two patterns reunite fragments and ignite the core | 3 + 3 | Campaign complete and restored map |

Lumen Rise uses `shoulder_flexion`; Aether Wing uses `shoulder_abduction`; Terra Pulse uses `knee_flexion`. Physical names and the existing positioning/safety instructions remain visible. One recognized movement is one action. No range, speed, reaction-time or effort scoring. There are 21 actions total. Each ability change uses the existing tutorial/setup/Start flow so the player can change camera orientation safely; this deliberately takes additional setup clicks.

## Architecture

- `types/story.ts`: ability, realm, progress and objective-sequence types.
- `data/storyCampaign.ts`: realm/stage configuration and adaptation of existing exercise definitions.
- `data/storyLines.ts`: authored Nova dialogue; no Gemini story calls.
- `lib/storyProgress.ts`: pure unlock/reward rules, validated save decoding and objective-sequence advancement/reset.
- `lib/storyStorage.ts`: the only Story localStorage boundary, key `rehabverse.story.v1`.
- `components/story/StoryCampaign.tsx`: prologue, map, realm selection, fragment inventory, confirmed reset and storage errors.
- `StorySession.tsx`: objective orchestration and Story-only completion persistence/retry.
- `StoryWorld.tsx`: world-first presentation, current ability, visible sequence, modest action progress and SVG fallback.

`TrackedQuest` accepts an optional presentation host. Its existing MediaPipe loop, camera permissions/errors/retries, MovementAttemptEngine, detectors, side selection and Start/Begin/countdown remain authoritative. The host receives only recognized stage completion, tracking-loss notifications and display state/live pose. When hosted by Story, completion bypasses `saveCompletedSession` and invokes Story's own completion handler. Existing HEP/Explore callers do not supply this option and retain the original storage and completion behavior. Story never mounts a separate detector or writes to HEP/Explore history.

The sequence reducer counts completed objectives, not repetitions. A wrong ability event or active tracking loss resets the current three-ability pattern; prior finished patterns remain. No alternate classifier attempts to diagnose wrong movement. Each configured stage listens only to its existing detector. Incomplete levels restart on leaving/reloading; completed realm rewards persist. Replays are idempotent. Save failures remain visible with Retry; leaving unsaved completion needs explicit confirmation.

## Visual reuse

`IslandPresentation` and the teammate-derived `RehabWorldEngine` remain the sole Three.js path. Added optional camera focus, per-zone campaign restoration, live pose feed and ability effects. The original RehabWorldGame still serves existing HEP/Explore sessions.

The same engine draws Story crystal pylons, a gate, and the finale's three shards. Existing light-figure joints provide an effect origin when visible; upward, outward and ground-plane energy waves distinguish abilities. Crystal illumination, gate opening, particles, lighting and core reconstruction depend only on authoritative objective progress. Completed campaign maps show all zones restored. No Story sound engine was added: selected authored Nova lines use existing optional ElevenLabs playback and audio gating.

Reduced motion and WebGL failure retain a static SVG island plus textual objectives and controls. GPU effects, pose-feed animation frames, observers and listeners are disposed on unmount. Background rendering pauses. Reset cancels pending effects and disposes wave resources.

## Preserved systems

My HEP extraction/editing/inclusion/exclusion/comparison/scheduling, Gemini safety routing and approved Explore validation, existing storage/history, QuestExperience, GuidedQuest, movement thresholds and all three detectors are unchanged. Existing Nova preference, cancellation, server key handling and Start audio gating are reused. The voice allowlist adds only deterministic Story lines. No keys or environment files were changed.

## Validation and manual follow-up

Commands: `npm run lint`, `npx tsc --noEmit`, `npm run check:core`, `npm run check:story`, `npm run check:presentation`, `npm run build`.

Manual testing remains intentionally short and deferred: desktop/mobile layout, keyboard focus and map controls, WebGL/context-loss and reduced-motion fallbacks, body-to-world alignment, comfortable movement recognition for both arms and knee pattern, ability/camera orientation changes, active tracking loss and pattern reset, voice off/unavailable/audio gating, completed-map reload, cross-tab/reset behavior, and simulated storage write failures. Also smoke-test existing HEP/Explore camera and Guided sessions after the optional host extension.

No Fitness Tag, Tiger Data, multiplayer, authentication or other major feature was added.

### Final command results

- Lint: passed, no warnings.
- TypeScript (`npx tsc --noEmit`): passed.
- Core: 13 checks passed.
- Story: 10 checks passed.
- Presentation lifecycle: 4 checks passed, including Story wave disposal.
- Build: earlier builds generated all 14 routes including `/story`. The final build after the last celebration adjustment was blocked by Turbopack's worker attempting to bind an internal port (`Operation not permitted`, OS error 1). An escalated retry encountered the same restriction. No application behavior or build configuration was changed to bypass it; rerun `npm run build` in an unrestricted environment.
