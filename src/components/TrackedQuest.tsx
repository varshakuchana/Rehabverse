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
  const [tutorialComplete, setTutorialComplete] = useState(false);
  if (tutorialComplete) return <MovementQuestSession definition={{ ...definition, trackedSide }} onContinue={onContinue} presentation={presentation} />;
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto mb-8 max-w-5xl">
        <Link onClick={event => { if (presentation) { event.preventDefault(); presentation.onExit(); } }} href={presentation ? "/story" : definition.source === "hep" ? "/quest" : "/explore"} className="text-sm text-slate-400 hover:text-white">← Back to {presentation ? "World Map" : definition.source === "hep" ? "My Quest" : "Explore"}</Link>
      </div>
      {definition.detectorId?.startsWith("shoulder") && <fieldset className="mx-auto mb-6 max-w-5xl rounded-xl border border-white/20 p-5"><legend className="px-2">Which arm will you move?</legend><p className="mb-3 text-sm text-slate-300">Use your selected arm throughout. Follow any side specified in your HEP.</p>{(["left", "right"] as const).map(side => <label key={side} className="mr-6 inline-flex items-center gap-2 capitalize"><input type="radio" name="tracked-side" checked={trackedSide === side} onChange={() => setTrackedSide(side)} />{side}</label>)}</fieldset>}
      <ExerciseInstructor mode="tutorial" exercise={definition.instructor} onReady={() => setTutorialComplete(true)} />
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

  const progress = Math.min(
    (reps / target) * 100,
    100
  );

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            onClick={event => { if (presentation) { event.preventDefault(); presentation.onExit(); } }}
            href={presentation ? "/story" : definition.source === "hep" ? "/quest" : "/explore"}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to {presentation ? "World Map" : definition.source === "hep" ? "My Quest" : "Explore"}
          </Link>

          <div className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm text-indigo-200">
            {presentation ? "Story Mode" : definition.source === "hep" ? "My HEP" : "Explore"} · Interactive
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            {presentation ? "The Shattered Realms · Motion ability" : "RehabVerse Session"}
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">
            {instructor.name}
          </h1>

          {detectorId !== "knee_flexion" && <p className="mt-3 text-sm text-cyan-200">Tracking your {definition.trackedSide} arm · {detectorId === "shoulder_flexion" ? "Side-on camera view" : "Face the camera"}</p>}
          <p className="mt-3 max-w-2xl text-slate-400">
            {detector.cameraRequirements}
          </p>
        </div>

        {presentation && <SessionWorldSlot presentation={presentation} state={{ sessionState, reps, target, movementPhase, bodyDetected, landmarks: landmarksRef }} />}

        <ExerciseInstructor
          mode="session"
          allowSpeech={sessionState === "active" || sessionState === "complete"}
          exercise={instructor}
          message={getInstructorMessage({
            exercise: instructor,
            sessionState,
            trackingReady: cameraActive && bodyDetected && movementAngle !== null,
            movementPhase: movementPhase,
          })}
        />

        <section className="mb-8 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-6">
          <p aria-live="polite" className="text-3xl font-bold">
            {sessionState === "complete" ? "Session complete!" :
              sessionState === "countdown" ? countdown :
              sessionState === "active" ? (bodyDetected ? "GO!" : "Tracking paused") :
              sessionState === "ready" ? "READY" :
              cameraActive ? "Adjust your camera position" : "Enable Camera to get started"}
          </p>
          <p className="mt-3 text-slate-300">
            {sessionState === "active" && !bodyDetected
              ? `Completed movements are kept. Return to your starting position. ${detector.cameraRequirements}`
              : sessionState === "ready" ? `Say "Start" when you're ready`
              : sessionState === "complete" ? `You completed ${target} movements.`
              : "Say start or begin, or use Start. Movements count after GO."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(sessionState === "ready" || sessionState === "positioning") && (
              <button onClick={startSession} disabled={sessionState !== "ready"}
                className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">
                Start
              </button>
            )}
            {!presentation && sessionState === "complete" && (
              <button onClick={playAgain} className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400">
                Play Again
              </button>
            )}
            {cameraActive && (sessionState === "ready" || sessionState === "positioning") && (
              <>
                {voiceSupported && !voiceListening && (
                  <button onClick={restartVoiceListening} className="rounded-xl border border-white/20 px-4 py-3">
                    Enable voice start
                  </button>
                )}
              </>
            )}
          </div>
          {cameraActive && (
            <>
              <p role="status" className="mt-3 text-sm text-slate-300">
                {!voiceSupported ? "Voice start is not supported in this browser. Use the Start button when tracking is ready." : microphoneError || (voiceListening ? 'Listening for "Start"' : "Voice start is not listening. Enable voice start or use Start.")}
              </p>

            </>
          )}
        </section>

        {!presentation && sessionState === "complete" && (
          <div className="mb-6 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
            <p role="status" className="text-sm text-slate-200">{saveMessage}</p>
            {saveFailed && <button onClick={persistCompletion} className="mt-3 rounded-lg bg-indigo-500 px-4 py-2">Retry saving</button>}
            {onContinue && <button onClick={onContinue} disabled={saveFailed || !saveMessage} className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40">Continue quest →</button>}
            <Link href="/progress" className="mt-3 block text-sm text-cyan-200">View Progress →</Link>
          </div>
        )}

        {!presentation && <RehabWorldGame
          sessionState={sessionState}
          completedReps={reps}
          targetReps={target}
          movementProgress={movementPhase}
        />}

        <div className={`grid gap-6 ${presentation && sessionState === "active" ? "mx-auto max-w-xl" : "lg:grid-cols-[2fr_1fr]"}`}>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  Movement Camera
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {detector.cameraRequirements}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    modelReady
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {modelReady
                    ? "Tracker loaded"
                    : modelFailed ? "Tracking unavailable" : "Loading tracking…"}
                </div>

                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    cameraActive
                      ? "bg-green-500/20 text-green-300"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {cameraActive
                    ? "Camera Active"
                    : "Camera Off"}
                </div>
              </div>
            </div>

            <div className={`relative overflow-hidden bg-slate-950 ${cameraActive ? "aspect-video" : "min-h-80 sm:aspect-video"}`}>
              <video
                ref={videoRef}
                aria-label="Live movement camera"
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 h-full w-full object-contain ${
                  cameraActive
                    ? "block"
                    : "hidden"
                }`}
              />

              <canvas
                ref={canvasRef}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
                  cameraActive
                    ? "block"
                    : "hidden"
                }`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 text-6xl">
                    📷
                  </div>

                  <h3 role="status" className="mb-2 text-xl font-semibold">
                    {cameraStarting ? "Opening camera…" : "Camera is off"}
                  </h3>

                  <p className="mb-6 max-w-md text-sm leading-6 text-slate-400">
                    {cameraStarting ? "Respond to the camera permission prompt in your browser. Keep this page open while the camera starts." : "Enable your camera so RehabVerse can track your movement."}
                  </p>

                  <button
                    onClick={
                      startCamera
                    }
                    disabled={
                      !modelReady || cameraStarting
                    }
                    className={`rounded-xl px-6 py-3 font-semibold transition disabled:opacity-50 ${
                      modelReady
                        ? "bg-indigo-500 hover:bg-indigo-400"
                        : "cursor-not-allowed bg-slate-700 text-slate-400"
                    }`}
                  >
                    {cameraStarting ? "Opening camera…" : modelFailed ? "Tracking unavailable" : modelReady ? "Enable Camera" : "Loading tracking…"}
                  </button>
                </div>
              )}

              {cameraActive && (
                <>
                  <div className="absolute left-2 top-2">
                    <div
                      className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur ${
                        bodyDetected
                          ? "bg-green-500/20 text-green-200"
                          : "bg-amber-500/20 text-amber-200"
                      }`}
                    >
                      {bodyDetected
                        ? "✓ Tracking Ready"
                        : "Show the required landmarks"}
                    </div>
                  </div>

                  <div className="absolute bottom-2 right-2 max-w-[90%] rounded-xl bg-indigo-500/20 px-4 py-3 text-right backdrop-blur">
                    <p className="text-xs uppercase tracking-wider text-indigo-200">
                      Movement
                    </p>

                    <p className="font-bold">
                      {phaseLabel()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {cameraError && (
              <div role="alert" className="border-t border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                <p>{cameraError}</p>
                <div className="mt-3 flex flex-wrap gap-4">
                  {modelFailed && <button onClick={() => { setModelFailed(false); setCameraError(""); setModelRetry(value => value + 1); }} className="rounded-lg border border-white/20 px-3 py-2 text-white">Retry tracking</button>}
                  <Link href="/explore" className="self-center text-cyan-200 underline">Try a Guided quest →</Link>
                </div>
              </div>
            )}

            {cameraActive && (
              <div className="flex justify-end border-t border-white/10 p-4">
                <button
                  onClick={
                    stopCamera
                  }
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                  Turn Off Camera
                </button>
              </div>
            )}
          </section>

          {presentation && <p className="text-sm leading-6 text-amber-100/80">{instructor.safetyMessage}</p>}
          {!presentation && <aside className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Movement Status
              </p>

              <p
                className={`mt-2 text-xl font-semibold ${
                  movementPhase ===
                  "returning"
                    ? "text-green-300"
                    : "text-white"
                }`}
              >
                {phaseLabel()}
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {feedback}
              </p>


            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Completed Movements
              </p>

              <p className="mt-2 text-5xl font-bold">
                {reps}

                <span className="text-xl text-slate-500">
                  /{target}
                </span>
              </p>

              <div role="progressbar" aria-label="Completed movements" aria-valuemin={0} aria-valuemax={target} aria-valuenow={reps} className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Game Score
              </p>

              <p className="mt-2 text-3xl font-bold">
                {score}
              </p>

              <p className="mt-3 text-xs text-slate-500">
                +100 for each completed
                movement
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                Adaptive tracking
              </p>

              <p className="mt-2 text-sm leading-6 text-cyan-100/80">
                RehabVerse recognizes a
                controlled movement and return
                relative to your observed
                starting position instead of
                requiring one fixed movement
                depth.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
              <p className="text-sm leading-6 text-amber-100/80">
                {instructor.safetyMessage}
              </p>
            </div>
          </aside>}
        </div>
      </div>
    </main>
  );
}
