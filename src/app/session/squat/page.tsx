"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConfirmedPlan, useLocalDataStatus } from "@/hooks/useProgress";
import { exerciseKey, isPlayableExercise } from "@/lib/scheduleStorage";
import { localDateKey, saveCompletedSession } from "@/lib/progressStorage";
import type { CompletedSession } from "@/types/progress";
import type { QuestDefinition } from "@/types/quest";
import { exploreMovementQuest } from "@/data/exploreQuests";
import ExerciseInstructor from "@/components/ExerciseInstructor";
import { getInstructorMessage } from "@/lib/exerciseInstructor";
import { movementQuest } from "@/data/movementQuest";
import RehabWorldGame from "@/components/RehabWorldGame";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type SquatPhase = MovementPhase;

export default function MovementQuestPage() {
  return <Suspense fallback={<main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-950 p-8 text-slate-300"><p role="status">Loading quest…</p></main>}><QuestEntry /></Suspense>;
}

function QuestEntry() {
  const params = useSearchParams();
  const plan = useConfirmedPlan();
  const dataStatus = useLocalDataStatus();
  if (params.get("source") === "hep" && dataStatus === "loading") return <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-950 p-8 text-white"><p role="status">Loading your confirmed HEP…</p></main>;
  let definition: QuestDefinition = exploreMovementQuest;
  if (params.get("source") === "hep") {
    const index = Number(params.get("exercise"));
    const exercise = plan?.exercises[index];
    if (!plan || plan.id !== params.get("plan") || !params.has("exercise") || !Number.isInteger(index) || !exercise || !isPlayableExercise(exercise)) {
      return <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-950 p-10 text-white"><h1 className="text-2xl">Open a supported exercise from your confirmed HEP.</h1><p className="my-4 text-slate-400">A confirmed repetition target is required. Hold-based or unspecified doses remain in your plan for reference.</p><Link href="/quest" className="text-cyan-300">Back to My Quest →</Link></main>;
    }
    const target = exercise.repetitions! * (exercise.sets ?? 1);
    definition = {
      target, exerciseId: exerciseKey(plan, index), source: "hep", planId: plan.id,
      trackingCapability: "interactive",
      prescribedSets: exercise.sets ?? undefined,
      instructor: {
        ...movementQuest, name: exercise.name,
        prescription: { reps: exercise.repetitions!, sets: exercise.sets ?? undefined, repLabel: "reps per set" },
        instructions: [exercise.instructions, exercise.notes, ...(plan.generalInstructions ?? []),
          `${target} total movements across the prescribed sets. Follow your plan's set breaks; you can pause between movements.`].filter((text): text is string => Boolean(text)),
      },
    };
  }
  return <QuestTutorial key={JSON.stringify(definition)} definition={definition} />;
}

function QuestTutorial({ definition }: { definition: QuestDefinition }) {
  const [tutorialComplete, setTutorialComplete] = useState(false);
  if (tutorialComplete) return <MovementQuestSession definition={definition} />;
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto mb-8 max-w-5xl">
        <Link href={definition.source === "hep" ? "/quest" : "/explore"} className="text-sm text-slate-400 hover:text-white">← Back to {definition.source === "hep" ? "My Quest" : "Explore"}</Link>
      </div>
      <ExerciseInstructor mode="tutorial" exercise={definition.instructor} onReady={() => setTutorialComplete(true)} />
    </main>
  );
}

function MovementQuestSession({ definition }: { definition: QuestDefinition }) {
  const { target, instructor } = definition;
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

  const [kneeAngle, setKneeAngle] =
    useState<number | null>(null);

  const [squatPhase, setSquatPhase] =
    useState<SquatPhase>("waiting");

  const [reps, setReps] = useState(0);
  const score = reps * 100;

  const [feedback, setFeedback] = useState(
    "Step into frame and stand naturally."
  );

  function resetMovement() {
    movementEngineRef.current.reset();
    smoothedAngleRef.current = null;
    setSquatPhase("waiting");
  }

  const {
    sessionState, countdown, voiceSupported, voiceListening,
    microphoneError, startSession, completeSession, resetSession,
    restartVoiceListening, reportTrackingLost, isSessionActive,
  } = useHandsFreeStart({
    trackingReady: cameraActive && bodyDetected && kneeAngle !== null,
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
    setFeedback("Stand naturally and get ready to start.");
  }

  function trackingLost() {
    reportTrackingLost();
    setBodyDetected(false);
    setKneeAngle(null);
    resetMovement();
    setFeedback("Make sure your hips, knees, and ankles are visible.");
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

  function calculateAngle(
    a: Landmark,
    b: Landmark,
    c: Landmark
  ) {
    const radians =
      Math.atan2(
        c.y - b.y,
        c.x - b.x
      ) -
      Math.atan2(
        a.y - b.y,
        a.x - b.x
      );

    let angle = Math.abs(
      (radians * 180) / Math.PI
    );

    if (angle > 180) {
      angle = 360 - angle;
    }

    return angle;
  }

  function landmarkVisible(
    landmark: Landmark | undefined
  ) {
    return Boolean(
      landmark &&
        (landmark.visibility ?? 1) > 0.55
    );
  }

  function getKneeAngle(
    landmarks: Landmark[]
  ) {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    const validAngles: number[] = [];

    if (
      landmarkVisible(leftHip) &&
      landmarkVisible(leftKnee) &&
      landmarkVisible(leftAnkle)
    ) {
      validAngles.push(
        calculateAngle(
          leftHip,
          leftKnee,
          leftAnkle
        )
      );
    }

    if (
      landmarkVisible(rightHip) &&
      landmarkVisible(rightKnee) &&
      landmarkVisible(rightAnkle)
    ) {
      validAngles.push(
        calculateAngle(
          rightHip,
          rightKnee,
          rightAnkle
        )
      );
    }

    if (validAngles.length === 0) {
      return null;
    }

    return (
      validAngles.reduce(
        (sum, angle) => sum + angle,
        0
      ) / validAngles.length
    );
  }

  function processSquat(
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

    setKneeAngle(angle);

    if (!isSessionActive()) return;

    /*
      The movement engine recognizes
      movement relative to the user's
      observed starting position.

      It does not require a universal
      squat-depth target.
    */
    const result =
      movementEngineRef.current.process(
        angle,
        performance.now()
      );

    setSquatPhase(result.phase);
    setFeedback(result.feedback);

    if (result.completedAttempt) {
      const nextReps = Math.min(reps + 1, target);
      setReps(nextReps);
      if (nextReps === target) {
        completeSession();
        const now = new Date();
        pendingRecordRef.current = {
          id: sessionIdRef.current ?? crypto.randomUUID(),
          exerciseId: definition.exerciseId, exerciseName: instructor.name,
          completedAt: now.toISOString(), completedLocalDate: localDateKey(now),
          completedReps: nextReps, targetReps: target, prescribedSets: definition.prescribedSets,
          status: "complete", completionMethod: "camera-tracked", score: nextReps * 100, source: definition.source, planId: definition.planId,
        };
        persistCompletion();
        resetMovement();
        setFeedback(`All ${target} movements completed!`);
      } else {
        setFeedback("Movement completed! Get ready for the next one.");
      }
    }
  }

  // The camera loop outlives a render; always process with the latest rep count.
  const processSquatRef = useRef<(angle: number) => void>(() => {});
  useLayoutEffect(() => {
    processSquatRef.current = processSquat;
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
    setKneeAngle(null);
    setSquatPhase("waiting");

    setFeedback(
      "Step into frame and stand naturally."
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

          const angle =
            getKneeAngle(
              landmarks
            );

          /*
            Exercise readiness is based on
            whether the landmarks needed
            for the knee-angle measurement
            are actually visible.

            Seeing any part of the body is
            not enough for this exercise.
          */
          if (angle !== null) {
            setBodyDetected(true);

            processSquatRef.current(angle);
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
    switch (squatPhase) {
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
            href={definition.source === "hep" ? "/quest" : "/explore"}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to {definition.source === "hep" ? "My Quest" : "Explore"}
          </Link>

          <div className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm text-indigo-200">
            {definition.source === "hep" ? "My HEP" : "Explore"} · Interactive
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            RehabVerse Session
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">
            {instructor.name}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Position yourself so your hips,
            knees, and ankles are visible.
            RehabVerse will track your movement
            pattern in real time.
          </p>
        </div>

        <ExerciseInstructor
          mode="session"
          allowSpeech={sessionState === "active" || sessionState === "complete"}
          exercise={instructor}
          message={getInstructorMessage({
            exercise: instructor,
            sessionState,
            trackingReady: cameraActive && bodyDetected && kneeAngle !== null,
            movementPhase: squatPhase,
          })}
        />

        <section className="mb-8 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-6">
          <p aria-live="polite" className="text-3xl font-bold">
            {sessionState === "complete" ? "Session complete!" :
              sessionState === "countdown" ? countdown :
              sessionState === "active" ? (bodyDetected ? "GO!" : "Tracking paused") :
              sessionState === "ready" ? "READY" :
              cameraActive ? "Show your hips, knees, and ankles" : "Enable Camera to get started"}
          </p>
          <p className="mt-3 text-slate-300">
            {sessionState === "active" && !bodyDetected
              ? "Completed movements are kept for this quest. Return to your starting position with your hips, knees, and ankles in view."
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
            {sessionState === "complete" && (
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

        {sessionState === "complete" && (
          <div className="mb-6 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
            <p role="status" className="text-sm text-slate-200">{saveMessage}</p>
            {saveFailed && <button onClick={persistCompletion} className="mt-3 rounded-lg bg-indigo-500 px-4 py-2">Retry saving</button>}
            <Link href="/progress" className="mt-3 block text-sm text-cyan-200">View Progress →</Link>
          </div>
        )}

        <RehabWorldGame
          sessionState={sessionState}
          completedReps={reps}
          targetReps={target}
          movementProgress={squatPhase}
        />

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  Movement Camera
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Keep your hips, knees, and
                  ankles inside the frame.
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
                        : "Show hips, knees & ankles"}
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

          <aside className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Movement Status
              </p>

              <p
                className={`mt-2 text-xl font-semibold ${
                  squatPhase ===
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
          </aside>
        </div>
      </div>
    </main>
  );
}
