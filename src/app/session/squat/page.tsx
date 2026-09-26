"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RehabRunnerGame from "@/components/RehabRunnerGame";

type PoseLandmarkerType = import("@mediapipe/tasks-vision").PoseLandmarker;

type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

type SquatPhase = "waiting" | "standing" | "lowering" | "down" | "rising";

export default function SquatSessionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const poseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const squatPhaseRef = useRef<SquatPhase>("waiting");
  const reachedBottomRef = useRef(false);
  const smoothedAngleRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [bodyDetected, setBodyDetected] = useState(false);

  const [kneeAngle, setKneeAngle] = useState<number | null>(null);
  const [squatPhase, setSquatPhase] = useState<SquatPhase>("waiting");
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(0);
  const [jumpSignal, setJumpSignal] = useState(0);
  const [feedback, setFeedback] = useState(
    "Step into frame and stand naturally."
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPoseModel() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        );

        if (cancelled) return;

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
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
        });

        if (cancelled) {
          poseLandmarker.close();
          return;
        }

        poseLandmarkerRef.current = poseLandmarker;
        setModelReady(true);
      } catch (error) {
        console.error("MediaPipe loading error:", error);

        setCameraError(
          "Pose tracking could not load. Check the browser console for details."
        );
      }
    }

    loadPoseModel();

    return () => {
      cancelled = true;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  function calculateAngle(a: Landmark, b: Landmark, c: Landmark) {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) -
      Math.atan2(a.y - b.y, a.x - b.x);

    let angle = Math.abs((radians * 180) / Math.PI);

    if (angle > 180) {
      angle = 360 - angle;
    }

    return angle;
  }

  function landmarkVisible(landmark: Landmark | undefined) {
    return Boolean(landmark && (landmark.visibility ?? 1) > 0.55);
  }

  function getKneeAngle(landmarks: Landmark[]) {
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
        calculateAngle(leftHip, leftKnee, leftAnkle)
      );
    }

    if (
      landmarkVisible(rightHip) &&
      landmarkVisible(rightKnee) &&
      landmarkVisible(rightAnkle)
    ) {
      validAngles.push(
        calculateAngle(rightHip, rightKnee, rightAnkle)
      );
    }

    if (validAngles.length === 0) {
      return null;
    }

    return (
      validAngles.reduce((sum, angle) => sum + angle, 0) /
      validAngles.length
    );
  }

  function processSquat(rawAngle: number) {
    /*
      Smooth the angle slightly so tiny MediaPipe movements
      don't rapidly change the squat state.
    */
    const previous = smoothedAngleRef.current;

    const smoothed =
      previous === null
        ? rawAngle
        : previous * 0.7 + rawAngle * 0.3;

    smoothedAngleRef.current = smoothed;

    const angle = Math.round(smoothed);

    setKneeAngle(angle);

    const currentPhase = squatPhaseRef.current;

    /*
      Prototype thresholds:

      155°+  = standing
      125–155 = lowering / rising
      <= 115° = squat depth reached

      The gap between 115 and 155 helps prevent
      one squat from being counted several times.
    */

    if (angle >= 155) {
      if (reachedBottomRef.current) {
        setReps((previousReps) => {
          const nextReps = Math.min(previousReps + 1, 10);
          return nextReps;
        });

        setScore((previousScore) => previousScore + 100);

        setJumpSignal((previous) => previous + 1);

        reachedBottomRef.current = false;

        setFeedback("Great rep! Get ready for the next one.");

        squatPhaseRef.current = "standing";
        setSquatPhase("standing");

        return;
      }

      squatPhaseRef.current = "standing";
      setSquatPhase("standing");
      setFeedback("Ready — lower into a controlled squat.");

      return;
    }

    if (angle <= 115) {
      reachedBottomRef.current = true;

      squatPhaseRef.current = "down";
      setSquatPhase("down");

      setFeedback("Squat reached! Now stand back up.");

      return;
    }

    if (currentPhase === "down" || reachedBottomRef.current) {
      squatPhaseRef.current = "rising";
      setSquatPhase("rising");

      setFeedback("Good — return to standing.");

      return;
    }

    squatPhaseRef.current = "lowering";
    setSquatPhase("lowering");

    setFeedback("Keep lowering with control.");
  }

  async function startCamera() {
    try {
      setCameraError("");

      if (!modelReady) {
        setCameraError(
          "Pose model is still loading. Wait a moment and try again."
        );
        return;
      }

      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = cameraStream;

      if (!videoRef.current) return;

      videoRef.current.srcObject = cameraStream;

      await videoRef.current.play();

      setCameraActive(true);

      squatPhaseRef.current = "waiting";
      reachedBottomRef.current = false;
      smoothedAngleRef.current = null;
      lastVideoTimeRef.current = -1;

      predictWebcam();
    } catch (error) {
      console.error("Camera error:", error);

      setCameraError(
        "Camera access failed. Please allow camera permission in your browser."
      );
    }
  }

  function stopCamera() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;

    if (canvas) {
      const context = canvas.getContext("2d");

      context?.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    squatPhaseRef.current = "waiting";
    reachedBottomRef.current = false;
    smoothedAngleRef.current = null;

    setCameraActive(false);
    setBodyDetected(false);
    setKneeAngle(null);
    setSquatPhase("waiting");
    setFeedback("Step into frame and stand naturally.");
  }

  function drawPose(landmarks: Landmark[]) {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    for (const [startIndex, endIndex] of connections) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];

      if (!start || !end) continue;

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

    for (const landmark of landmarks) {
      if (!landmarkVisible(landmark)) continue;

      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();

      ctx.arc(x, y, 6, 0, Math.PI * 2);

      ctx.fillStyle = "#22d3ee";
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  function predictWebcam() {
    const video = videoRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (
      !video ||
      !poseLandmarker ||
      !streamRef.current ||
      video.readyState < 2
    ) {
      animationFrameRef.current =
        requestAnimationFrame(predictWebcam);

      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const result = poseLandmarker.detectForVideo(
          video,
          performance.now()
        );

        if (
          result.landmarks &&
          result.landmarks.length > 0
        ) {
          const landmarks =
            result.landmarks[0] as Landmark[];

          setBodyDetected(true);

          drawPose(landmarks);

          const angle = getKneeAngle(landmarks);

          if (angle !== null) {
            processSquat(angle);
          } else {
            setKneeAngle(null);

            setFeedback(
              "Make sure your hips, knees, and ankles are visible."
            );
          }
        } else {
          setBodyDetected(false);
          setKneeAngle(null);

          squatPhaseRef.current = "waiting";
          reachedBottomRef.current = false;
          smoothedAngleRef.current = null;

          setSquatPhase("waiting");

          setFeedback(
            "Move your full body into the camera frame."
          );

          const canvas = canvasRef.current;

          if (canvas) {
            const ctx = canvas.getContext("2d");

            ctx?.clearRect(
              0,
              0,
              canvas.width,
              canvas.height
            );
          }
        }
      } catch (error) {
        console.error("Pose detection error:", error);
      }
    }

    animationFrameRef.current =
      requestAnimationFrame(predictWebcam);
  }

  function phaseLabel() {
    switch (squatPhase) {
      case "standing":
        return "READY";

      case "lowering":
        return "LOWERING";

      case "down":
        return "SQUAT DETECTED ✓";

      case "rising":
        return "RETURNING";

      default:
        return "WAITING";
    }
  }

  const progress = Math.min((reps / 10) * 100, 100);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/exercises"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Exercises
          </Link>

          <div className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm text-indigo-200">
            🦵 Squat Challenge
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            RehabVerse Session
          </p>

          <h1 className="text-4xl font-bold">
            Squat Challenge
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Position yourself so your full body is visible.
            RehabVerse will track your movement in real time.
          </p>
        </div>

        <div className="mb-8">
         <RehabRunnerGame
           jumpSignal={jumpSignal}
           reps={reps}
           bodyReady={bodyDetected && kneeAngle !== null}
         />
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold">
                  Movement Camera
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Keep your full body inside the frame.
                </p>
              </div>

              <div className="flex gap-2">
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    modelReady
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {modelReady
                    ? "AI Ready"
                    : "Loading AI..."}
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

            <div className="relative aspect-video overflow-hidden bg-slate-950">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 h-full w-full object-cover ${
                  cameraActive ? "block" : "hidden"
                }`}
              />

              <canvas
                ref={canvasRef}
                className={`pointer-events-none absolute inset-0 h-full w-full ${
                  cameraActive ? "block" : "hidden"
                }`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 text-6xl">
                    📷
                  </div>

                  <h3 className="mb-2 text-xl font-semibold">
                    Camera is off
                  </h3>

                  <p className="mb-6 max-w-md text-sm leading-6 text-slate-400">
                    Enable your camera so RehabVerse can
                    track your body.
                  </p>

                  <button
                    onClick={startCamera}
                    disabled={!modelReady}
                    className={`rounded-xl px-6 py-3 font-semibold transition ${
                      modelReady
                        ? "bg-indigo-500 hover:bg-indigo-400"
                        : "cursor-not-allowed bg-slate-700 text-slate-400"
                    }`}
                  >
                    {modelReady
                      ? "Enable Camera"
                      : "Loading Pose AI..."}
                  </button>
                </div>
              )}

              {cameraActive && (
                <>
                  <div className="absolute left-4 top-4">
                    <div
                      className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur ${
                        bodyDetected
                          ? "bg-green-500/20 text-green-200"
                          : "bg-amber-500/20 text-amber-200"
                      }`}
                    >
                      {bodyDetected
                        ? "✓ Body Detected"
                        : "Move full body into frame"}
                    </div>
                  </div>

                  {kneeAngle !== null && (
                    <div className="absolute bottom-4 left-4 rounded-xl bg-slate-950/70 px-4 py-3 backdrop-blur">
                      <p className="text-xs uppercase tracking-wider text-slate-400">
                        Knee Angle
                      </p>

                      <p className="text-2xl font-bold">
                        {kneeAngle}°
                      </p>
                    </div>
                  )}

                  <div className="absolute bottom-4 right-4 rounded-xl bg-indigo-500/20 px-4 py-3 text-right backdrop-blur">
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
              <div className="border-t border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                {cameraError}
              </div>
            )}

            {cameraActive && (
              <div className="flex justify-end border-t border-white/10 p-4">
                <button
                  onClick={stopCamera}
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
                  squatPhase === "down"
                    ? "text-green-300"
                    : "text-white"
                }`}
              >
                {phaseLabel()}
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {feedback}
              </p>

              {kneeAngle !== null && (
                <div className="mt-4 rounded-xl bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-500">
                    Current knee angle
                  </p>

                  <p className="mt-1 text-2xl font-bold text-indigo-300">
                    {kneeAngle}°
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Repetitions
              </p>

              <p className="mt-2 text-5xl font-bold">
                {reps}
                <span className="text-xl text-slate-500">
                  /10
                </span>
              </p>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
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
                +100 for each completed movement
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
              <p className="text-sm leading-6 text-amber-100/80">
                Demo prototype only. Perform movements
                comfortably and stop if you experience
                discomfort.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}