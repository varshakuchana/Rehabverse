"use client";

import type { SessionPresentation, SessionVisualState } from "@/types/sessionPresentation";
import Link from "next/link";
import { detectors, landmarkVisible, measureMovement, type TrackedSide } from "@/lib/movementDetectors";

import { localDateKey, saveCompletedSession } from "@/lib/progressStorage";
import type { CompletedSession } from "@/types/progress";
import type { QuestDefinition } from "@/types/quest";
import ExerciseInstructor from "@/components/ExerciseInstructor";
import { getInstructorMessage } from "@/lib/exerciseInstructor";
import RehabWorldGame from "@/components/RehabWorldGame";
import ExerciseWorld from "@/components/ExerciseWorld";
import NovaVoiceControl from "@/components/NovaVoiceControl";
import { Stage, StageActions, StageCenter, StageCoach, StageCountdown, StageCounter, StagePanel, StagePip, StagePrimary, StageTopBar, stageBtn } from "@/components/stage/Stage";
import { THEMES, demoFor, worldFor } from "@/lib/worldTheme";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHandsFreeStart } from "@/hooks/useHandsFreeStart";
import {
  MovementAttemptEngine,
  type MovementPhase,
} from "@/lib/movementEngine";

type PoseLandmarkerType =
  import("@mediapipe/tasks-vision").PoseLandmarker;

type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

// A component boundary keeps the live pose ref opaque to React rendering.
// The world consumes it only in its animation effect, never to render JSX.
function SessionWorldSlot({ presentation, state }: { presentation: SessionPresentation; state: SessionVisualState }) {
  return presentation.renderWorld(state);
}

export default function TrackedQuest({ definition, onContinue, presentation }: { definition: QuestDefinition; onContinue?: () => void; presentation?: SessionPresentation }) {
  const [trackedSide, setTrackedSide] = useState<TrackedSide>(definition.trackedSide ?? "left");
  const [tutorialComplete, setTutorialComplete] = useState(Boolean(presentation?.skipIntro));
  if (tutorialComplete) return <MovementQuestSession definition={{ ...definition, trackedSide }} onContinue={onContinue} presentation={presentation} />;
  const backHref = presentation ? "/story" : definition.source === "hep" ? "/quest" : "/explore";
  const backLabel = presentation ? "Pause" : definition.source === "hep" ? "My quest" : "Explore";
  const world = presentation ? undefined : worldFor(definition);
  const accent = world ? THEMES[world].accent : "#F2C14E";
  const armPicker = definition.detectorId?.startsWith("shoulder") ? (
          <fieldset className="mt-5 rounded-2xl border border-white/20 p-4">
            <legend className="px-2 font-display font-semibold">Which arm will you move?</legend>
            <p className="mb-3 text-[15px] opacity-80">Use this arm the whole time. Follow any side your plan specifies.</p>
            <div className="flex gap-2">
              {(["left", "right"] as const).map(side => (
                <label key={side} className="relative cursor-pointer">
                  <input type="radio" name="tracked-side" className="peer sr-only" checked={trackedSide === side} onChange={() => setTrackedSide(side)} />
                  <span className="grid min-h-12 min-w-28 place-items-center rounded-full border-2 border-white/40 px-5 font-display font-semibold capitalize transition peer-checked:text-[#1b1535] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-[#F2C14E]"
                    style={trackedSide === side ? { background: accent, borderColor: accent } : undefined}>{side} arm</span>
                </label>
              ))}
            </div>
          </fieldset>
) : undefined;
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#161A30] text-[#F4F6F2]">
      <ExerciseInstructor
        mode="tutorial"
        exercise={definition.instructor}
        onReady={() => setTutorialComplete(true)}
        world={world}
        demo={demoFor(definition)}
        backLink={
          <Link onClick={event => { if (presentation) { event.preventDefault(); presentation.onExit(); } }} href={backHref}
            className="rounded-full bg-[rgba(24,28,54,.55)] px-4 py-2 text-[15px] backdrop-blur-md transition hover:bg-[rgba(24,28,54,.85)]">
            <span aria-hidden>←</span> Back to {backLabel}
          </Link>
        }
        beforeSteps={armPicker}
      />
    </main>
  );
}

function MovementQuestSession({ definition, onContinue, presentation }: { definition: QuestDefinition; onContinue?: () => void; presentation?: SessionPresentation }) {
  const { target, instructor } = definition;
  const landmarksRef = useRef<Landmark[] | null>(null);
  const trackingLossReportedRef = useRef(false);
  const detectorId = definition.detectorId ?? "knee_flexion";
  const detector = detectors[detectorId];
  const sessionIdRef = useRef<string | null>(null);
  const pendingRecordRef = useRef<CompletedSession | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  function persistCompletion() {
    if (!pendingRecordRef.current) return;
    try {
      saveCompletedSession(pendingRecordRef.current);
      setSaveFailed(false);
      setSaveMessage("Quest saved to your Progress on this device.");
    } catch {
      setSaveFailed(true);
      setSaveMessage("Your quest is complete, but browser storage could not save it. Retry before leaving or playing again.");
    }
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const poseLandmarkerRef =
    useRef<PoseLandmarkerType | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const lastVideoTimeRef = useRef(-1);

  const movementEngineRef = useRef(
    new MovementAttemptEngine()
  );

  const smoothedAngleRef =
    useRef<number | null>(null);

  const [cameraActive, setCameraActive] =
    useState(false);

  const openingCameraRef = useRef(false);
  const mountedRef = useRef(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [modelRetry, setModelRetry] = useState(0);

  const [cameraError, setCameraError] =
    useState("");

  const [modelReady, setModelReady] =
    useState(false);

  const [bodyDetected, setBodyDetected] =
    useState(false);

  const [movementAngle, setMovementAngle] =
    useState<number | null>(null);

  const [movementPhase, setMovementPhase] =
    useState<MovementPhase>("waiting");

  const [reps, setReps] = useState(0);
  const score = reps * 100;

  const [feedback, setFeedback] = useState(
    instructor.positioning
  );

  function resetMovement() {
    movementEngineRef.current.reset();
    smoothedAngleRef.current = null;
    setMovementPhase("waiting");
  }

  const {
    sessionState, countdown, voiceSupported, voiceListening,
    microphoneError, startSession, completeSession, resetSession,
    restartVoiceListening, reportTrackingLost, isSessionActive,
  } = useHandsFreeStart({
    trackingReady: cameraActive && bodyDetected && movementAngle !== null,
    onSessionStart: () => {
      sessionIdRef.current = crypto.randomUUID();
      resetMovement();
      setFeedback("GO! Hold your starting position for a moment.");
    },
  });

  function playAgain() {
    sessionIdRef.current = null;
    pendingRecordRef.current = null;
    setSaveMessage("");
    setSaveFailed(false);
    resetSession();
    resetMovement();
    setReps(0);
    setFeedback(instructor.positioning);
  }

  function trackingLost() {
    landmarksRef.current = null;
    if (isSessionActive() && !trackingLossReportedRef.current) {
      trackingLossReportedRef.current = true;
      presentation?.onTrackingLost();
    }
    reportTrackingLost();
    setBodyDetected(false);
    setMovementAngle(null);
    resetMovement();
    setFeedback(detector.cameraRequirements);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    async function loadPoseModel() {
      try {
        const {
          FilesetResolver,
          PoseLandmarker,
        } = await import(
          "@mediapipe/tasks-vision"
        );

        const vision =
          await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
          );

        if (cancelled) return;

        const poseLandmarker =
          await PoseLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU",
              },

              runningMode: "VIDEO",
              numPoses: 1,

              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }
          );

        if (cancelled) {
          poseLandmarker.close();
          return;
        }

        poseLandmarkerRef.current =
          poseLandmarker;

        setModelReady(true);
      } catch {
        if (cancelled) return;
        setModelFailed(true);
        setCameraError("Pose tracking could not load. Check your connection and retry, or choose a Guided quest.");
      }
    }

    loadPoseModel();

    return () => {
      cancelled = true;
      mountedRef.current = false;

      if (
        animationFrameRef.current !== null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, [modelRetry]);

  function processMovement(
    rawAngle: number
  ) {
    /*
      Smooth MediaPipe measurements so
      small tracking fluctuations do not
      become movement events.
    */
    const previous =
      smoothedAngleRef.current;

    const smoothed =
      previous === null
        ? rawAngle
        : previous * 0.7 +
          rawAngle * 0.3;

    smoothedAngleRef.current =
      smoothed;

    const angle =
      Math.round(smoothed);

    setMovementAngle(angle);

    if (!isSessionActive()) return;

    /*
      The movement engine recognizes
      movement relative to the user's
      observed starting position.

      It does not require a universal
      clinical movement target.
    */
    const result =
      movementEngineRef.current.process(
        angle,
        performance.now()
      );

    setMovementPhase(result.phase);
    setFeedback(result.feedback);

    if (result.completedAttempt) {
      const nextReps = Math.min(reps + 1, target);
      setReps(nextReps);
      if (nextReps === target) {
        completeSession();
        if (presentation) {
          // The host owns story objectives and storage; never save Story to activity history.
          presentation.onComplete();
        } else {
          const now = new Date();
          pendingRecordRef.current = {
            id: sessionIdRef.current ?? crypto.randomUUID(),
            exerciseId: definition.exerciseId, exerciseName: instructor.name,
            completedAt: now.toISOString(), completedLocalDate: localDateKey(now),
            completedReps: nextReps, targetReps: target, prescribedSets: definition.prescribedSets,
            status: "complete", completionMethod: "camera-tracked", score: nextReps * 100, source: definition.source, planId: definition.planId,
          };
          persistCompletion();
        }
        resetMovement();
        setFeedback(`All ${target} movements completed!`);
      } else {
        setFeedback("Movement completed! Get ready for the next one.");
      }
    }
  }

  // The camera loop outlives a render; always process with the latest rep count.
  const processMovementRef = useRef<(angle: number) => void>(() => {});
  useLayoutEffect(() => {
    processMovementRef.current = processMovement;
  });

  // Story: after the first stage the camera comes back on by itself (permission is already granted).
  // Story: later stages start their own countdown as soon as the player is in view.
  const autoCountdownRef = useRef(false);
  useEffect(() => {
    if (!presentation?.autoStart || autoCountdownRef.current || sessionState !== "ready") return;
    autoCountdownRef.current = true;
    startSession();
  }, [presentation?.autoStart, sessionState, startSession]);
  const autoStartedRef = useRef(false);
  const startCameraRef = useRef(async () => {});
  useEffect(() => { startCameraRef.current = startCamera; });
  useEffect(() => {
    if (!presentation?.autoCamera || autoStartedRef.current || !modelReady || cameraActive || cameraStarting) return;
    autoStartedRef.current = true;
    void startCameraRef.current();
  }, [presentation?.autoCamera, modelReady, cameraActive, cameraStarting]);

  async function startCamera() {
    if (openingCameraRef.current || streamRef.current) return;
    if (!modelReady) {
      setCameraError("Tracking is still loading. Wait a moment and try again.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable here. Use a supported browser over HTTPS or localhost, or choose a Guided quest.");
      return;
    }
    openingCameraRef.current = true;
    setCameraStarting(true);
    setCameraError("");
    try {
      // Keep speech startup inside the user click, before awaiting camera access.
      if (voiceSupported) restartVoiceListening();
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      if (!mountedRef.current || !videoRef.current) {
        cameraStream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = cameraStream;
      videoRef.current.srcObject = cameraStream;
      await videoRef.current.play();
      if (!mountedRef.current) { cameraStream.getTracks().forEach(track => track.stop()); return; }
      cameraStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (!mountedRef.current) return;
          stopCamera();
          setCameraError("The camera disconnected. Reconnect it and enable the camera to continue. Your completed movements are kept.");
        };
      });
      setCameraActive(true);
      resetMovement();
      lastVideoTimeRef.current = -1;
      predictWebcam();
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (!mountedRef.current) return;
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError" || name === "SecurityError"
        ? "Camera permission was denied. Allow camera access in your browser's site settings, then try Enable Camera again."
        : name === "NotFoundError"
          ? "No camera was found. Connect a camera, or try a Guided quest without one."
          : name === "NotReadableError"
            ? "The camera is busy or unavailable. Close other apps using it and try again."
            : "Camera access failed. Check your camera connection and try again, or choose a Guided quest.");
    } finally {
      openingCameraRef.current = false;
      if (mountedRef.current) setCameraStarting(false);
    }
  }

  function stopCamera() {
    trackingLost();
    if (
      animationFrameRef.current !== null
    ) {
      cancelAnimationFrame(
        animationFrameRef.current
      );

      animationFrameRef.current = null;
    }

    streamRef.current
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }

    const canvas =
      canvasRef.current;

    if (canvas) {
      const context =
        canvas.getContext("2d");

      context?.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    movementEngineRef.current.reset();

    smoothedAngleRef.current = null;

    setCameraActive(false);
    setBodyDetected(false);
    setMovementAngle(null);
    setMovementPhase("waiting");

    setFeedback(
      instructor.positioning
    );
  }

  function drawPose(
    landmarks: Landmark[]
  ) {
    const canvas =
      canvasRef.current;

    const video =
      videoRef.current;

    if (!canvas || !video) {
      return;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const connections = [
      [11, 12],

      [11, 13],
      [13, 15],

      [12, 14],
      [14, 16],

      [11, 23],
      [12, 24],

      [23, 24],

      [23, 25],
      [25, 27],

      [24, 26],
      [26, 28],

      [27, 29],
      [29, 31],
      [27, 31],

      [28, 30],
      [30, 32],
      [28, 32],
    ];

    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#818cf8";

    for (
      const [
        startIndex,
        endIndex,
      ] of connections
    ) {
      const start =
        landmarks[startIndex];

      const end =
        landmarks[endIndex];

      if (!start || !end) {
        continue;
      }

      if (
        !landmarkVisible(start) ||
        !landmarkVisible(end)
      ) {
        continue;
      }

      ctx.beginPath();

      ctx.moveTo(
        start.x * canvas.width,
        start.y * canvas.height
      );

      ctx.lineTo(
        end.x * canvas.width,
        end.y * canvas.height
      );

      ctx.stroke();
    }

    for (
      const landmark of landmarks
    ) {
      if (
        !landmarkVisible(landmark)
      ) {
        continue;
      }

      const x =
        landmark.x * canvas.width;

      const y =
        landmark.y * canvas.height;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = "#22d3ee";
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  function predictWebcam() {
    const video =
      videoRef.current;

    const poseLandmarker =
      poseLandmarkerRef.current;

    if (!streamRef.current) return;

    if (
      !video ||
      !poseLandmarker ||
      !streamRef.current ||
      video.readyState < 2
    ) {
      trackingLost();
      animationFrameRef.current =
        requestAnimationFrame(
          predictWebcam
        );

      return;
    }

    if (
      video.currentTime !==
      lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current =
        video.currentTime;

      try {
        const result =
          poseLandmarker.detectForVideo(
            video,
            performance.now()
          );

        if (
          result.landmarks &&
          result.landmarks.length > 0
        ) {
          const landmarks =
            result.landmarks[0] as Landmark[];

          drawPose(landmarks);
          landmarksRef.current = landmarks;

          const angle =
            measureMovement(detectorId, landmarks, definition.trackedSide ?? null, video.videoWidth / video.videoHeight)?.angle ?? null;

          /*
            Exercise readiness is based on
            whether the landmarks needed
            for the selected movement measurement
            are actually visible.

            Seeing any part of the body is
            not enough for this exercise.
          */
          if (angle !== null) {
            trackingLossReportedRef.current = false;
            setBodyDetected(true);

            processMovementRef.current(angle);
          } else {
            trackingLost();
          }
        } else {
          trackingLost();
        }
      } catch {
        stopCamera();
        setCameraError("Tracking was interrupted. Enable the camera again to resume. Your completed movements are kept.");
        return;
      }
    }

    animationFrameRef.current =
      requestAnimationFrame(
        predictWebcam
      );
  }

  function phaseLabel() {
    if (sessionState === "complete") return "QUEST COMPLETE";
    if (sessionState === "countdown") return "GET READY";
    if (sessionState === "ready") return "READY";
    if (sessionState === "active" && !bodyDetected) return "TRACKING PAUSED";
    if (sessionState === "positioning") return "POSITIONING";
    switch (movementPhase) {
      case "ready":
        return "READY";

      case "moving":
        return "MOVEMENT DETECTED";

      case "returning":
        return "RETURNING";

      default:
        return "FINDING START";
    }
  }

  const trackingReady = cameraActive && bodyDetected && movementAngle !== null;
  const active = sessionState === "active";
  const world = worldFor(definition);
  const theme = THEMES[world];
  const accent = presentation ? "#F2C14E" : theme.accent;
  const ink = presentation ? "#2A2410" : theme.ink;
  const novaMessage = getInstructorMessage({ exercise: instructor, sessionState, trackingReady, movementPhase });
  const backHref = presentation ? "/story" : definition.source === "hep" ? "/quest" : "/explore";
  const backLabel = presentation ? "Pause" : definition.source === "hep" ? "My quest" : "Explore";
  const onBack = (event: React.MouseEvent<HTMLAnchorElement>) => { if (presentation) { event.preventDefault(); presentation.onExit(); } };
  const armNote = detectorId !== "knee_flexion" ? `Tracking your ${definition.trackedSide} arm, ${detectorId === "shoulder_flexion" ? "side-on to the camera" : "facing the camera"}.` : undefined;
  const verbs = world === "well"
    ? { moving: "Down into the well", returning: "Haul it up" }
    : { moving: "Wings up", returning: "Now let it fly" };

  const coach = sessionState === "complete" ? { title: theme.done, hint: `You finished all ${target}. Take a breath.` }
    : sessionState === "countdown" ? { title: "Get ready", hint: "Movements count after GO." }
    : active && !bodyDetected ? { title: "Tracking paused", hint: `Your ${reps} ${reps === 1 ? "movement is" : "movements are"} kept. ${detector.cameraRequirements}` }
    : active ? { title: movementPhase === "moving" ? verbs.moving : movementPhase === "returning" ? verbs.returning : "Your turn", hint: feedback }
    : sessionState === "ready" ? { title: "Ready when you are", hint: 'Say "Start" or "Begin", or press Start.' }
    : cameraActive ? { title: "Step into view", hint: detector.cameraRequirements }
    : modelFailed ? { title: "Tracking didn't load", hint: "Check your connection and retry, or pick a Guided quest." }
    : { title: "Turn on your camera", hint: detector.positioning };

  const worldNode = presentation
    ? <div className="rv-stage-story absolute inset-0"><SessionWorldSlot presentation={presentation} state={{ sessionState, reps, target, movementPhase, bodyDetected, landmarks: landmarksRef }} /></div>
    : <ExerciseWorld key={`${world}:${target}`} world={world} completed={reps} target={target} active={active} phase={movementPhase} bodyReady={trackingReady} landmarks={landmarksRef}
        fallback={<RehabWorldGame sessionState={sessionState} completedReps={reps} targetReps={target} movementProgress={movementPhase} />} />;

  const voiceLine = !cameraActive || active || sessionState === "complete" ? "" :
    !voiceSupported ? "Voice start isn't supported in this browser. Use Start." :
    microphoneError || (voiceListening ? 'Listening for "Start"' : "Voice start is off.");

  return (
    <Stage accent={accent} label={`${instructor.name} session`} world={worldNode} plain={Boolean(presentation)}>
      <StageTopBar backHref={backHref} backLabel={backLabel} onBack={onBack}
        context={presentation ? "Story Mode. General movement game, not treatment." : `${definition.source === "hep" ? "From your PT's plan" : "Explore, not a prescription"}. Score ${score}.`} />

      {!presentation && (
        <StageCoach eyebrow={instructor.name} quest={theme.quest} title={coach.title} hint={coach.hint} note={armNote}
          accent={accent} demo={sessionState === "complete" ? null : demoFor(definition)}
          nova={<><p role="status" aria-atomic="true" className="text-[15px] leading-snug opacity-90">{novaMessage.text}</p><div className="mt-2"><NovaVoiceControl compact message={novaMessage} allowed={active || sessionState === "complete"} /></div></>} />
      )}
      <StagePip>
        <video ref={videoRef} aria-label="Live movement camera" autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`} />
        <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`} />
        {!cameraActive && (
          <p role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-[15px] opacity-80">
            {cameraStarting ? "Opening camera… answer the permission prompt." : modelFailed ? "Pose tracking didn't load" : modelReady ? "Camera is off" : "Loading pose tracking…"}
          </p>
        )}
        {cameraActive && (
          <p className="absolute bottom-2 left-2 rounded-full bg-[rgba(21,26,46,.82)] px-3 py-1 text-[13px]">
            {bodyDetected ? "Tracking you" : "Show the joints it needs"}{active && bodyDetected ? `, ${phaseLabel().toLowerCase()}` : ""}
          </p>
        )}
      </StagePip>
      {(voiceLine || cameraError) && (
        <div className="absolute right-5 top-[calc(4rem+min(13.5vw,202px)+14px)] z-10 w-[clamp(200px,24vw,360px)] space-y-2 text-[14px]">
          {voiceLine && <p role="status" className="rounded-2xl bg-[rgba(24,28,54,.72)] px-4 py-2 backdrop-blur-md">{voiceLine}</p>}
          {cameraError && (
            <div role="alert" className="rounded-2xl border border-[#FFB4A8]/40 bg-[rgba(60,24,30,.85)] px-4 py-3 backdrop-blur-md">
              <p>{cameraError}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {modelFailed && <button type="button" onClick={() => { setModelFailed(false); setCameraError(""); setModelRetry(value => value + 1); }} className="rv-link">Retry tracking</button>}
                {!presentation && <Link href="/explore" className="rv-link">Try a Guided quest</Link>}
              </div>
            </div>
          )}
        </div>
      )}

      {sessionState === "ready" && !presentation?.autoStart && (
        <StageCenter>
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-white/25 bg-[rgba(24,28,54,.84)] py-3 pl-7 pr-3 backdrop-blur-md">
            <p className="font-display text-xl font-semibold">{voiceListening ? <>Say <span style={{ color: accent }}>&ldquo;Start&rdquo;</span> or</> : "Ready?"}</p>
            <StagePrimary onClick={startSession} accent={accent} ink={ink}>Start</StagePrimary>
          </div>
        </StageCenter>
      )}
      {sessionState === "countdown" && countdown !== null && <StageCountdown value={countdown} accent={accent} />}

      {!presentation && (
        <StageCounter value={reps} target={target} unit={theme.unit} />
      )}

      <StageActions>
        {presentation && <div className="rounded-full bg-[rgba(24,28,54,.72)] p-1.5 backdrop-blur-md"><NovaVoiceControl compact message={novaMessage} allowed={active || sessionState === "complete"} /></div>}
        {cameraActive && voiceSupported && !voiceListening && (sessionState === "ready" || sessionState === "positioning") && (
          <button type="button" onClick={restartVoiceListening} className={stageBtn}>Listen for &ldquo;Start&rdquo;</button>
        )}
        {cameraActive && sessionState === "positioning" && !presentation?.autoStart && (
          <button type="button" onClick={startSession} disabled className={stageBtn}>Start</button>
        )}
        {cameraActive ? (
          sessionState !== "complete" && <button type="button" onClick={stopCamera} className={stageBtn}>Turn off camera</button>
        ) : (
          <StagePrimary onClick={startCamera} disabled={!modelReady || cameraStarting || modelFailed} accent={accent} ink={ink} big>
            {cameraStarting ? "Opening camera…" : modelFailed ? "Tracking unavailable" : modelReady ? "Turn on camera" : "Loading tracking…"}
          </StagePrimary>
        )}
      </StageActions>

      {!presentation && sessionState === "complete" && (
        <StagePanel>
          <p className="text-[15px]" style={{ color: accent }}>{theme.quest}</p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Quest complete</h2>
          <p className="mt-2 text-[18px] opacity-90">You finished {target} {target === 1 ? "movement" : "movements"} of {instructor.name}.</p>
          <p role="status" className="mt-4 text-[15px] opacity-85">{saveMessage}</p>
          {saveFailed && <button type="button" onClick={persistCompletion} className="rv-link mt-1 text-[15px]">Retry saving</button>}
          <div className="mt-6 flex flex-wrap gap-3">
            {onContinue && <StagePrimary onClick={onContinue} disabled={saveFailed || !saveMessage} accent={accent} ink={ink}>Continue quest →</StagePrimary>}
            <button type="button" onClick={playAgain} className={onContinue ? "rv-btn rv-btn-ghost" : "rv-btn border-0"} style={onContinue ? undefined : { background: accent, color: ink }}>Play again</button>
            <Link href="/progress" className="rv-btn rv-btn-ghost">Progress</Link>
            <Link href={backHref} className="rv-btn rv-btn-ghost">{backLabel}</Link>
          </div>
          <p className="mt-5 text-[14px] opacity-65">{instructor.safetyMessage}</p>
        </StagePanel>
      )}
    </Stage>
  );
}
