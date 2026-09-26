"use client";

import { useEffect, useRef, useState } from "react";

type RehabRunnerGameProps = {
  jumpSignal: number;
  reps: number;
  bodyReady: boolean;
};

export default function RehabRunnerGame({
  jumpSignal,
  reps,
  bodyReady,
}: RehabRunnerGameProps) {
  const [characterY, setCharacterY] = useState(0);
  const [obstacleX, setObstacleX] = useState(100);
  const [gameScore, setGameScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Stand in frame to begin");

  const jumpingRef = useRef(false);
  const obstacleXRef = useRef(100);
  const characterYRef = useRef(0);
  const collisionHandledRef = useRef(false);

  useEffect(() => {
    obstacleXRef.current = obstacleX;
  }, [obstacleX]);

  useEffect(() => {
    characterYRef.current = characterY;
  }, [characterY]);

  /*
    Every time the parent increments jumpSignal,
    the character performs one jump.
  */
  useEffect(() => {
    if (!gameStarted || gameOver || !bodyReady) return;
    if (jumpSignal === 0) return;
    if (jumpingRef.current) return;

    jumpingRef.current = true;

    setCharacterY(125);
    setMessage("Nice movement! ✨");

    const landingTimer = window.setTimeout(() => {
      setCharacterY(0);
      jumpingRef.current = false;
    }, 650);

    return () => {
      window.clearTimeout(landingTimer);
    };
  }, [jumpSignal, gameStarted, gameOver, bodyReady]);

  /*
    Main obstacle loop.
  */
  useEffect(() => {
    if (!gameStarted || gameOver || !bodyReady) return;

    const timer = window.setInterval(() => {
      setObstacleX((previous) => {
        let next = previous - 0.7;

        /*
          Character occupies approximately 10–22% of
          the game width.

          If the obstacle reaches that area while the
          character is too low, it counts as a collision.
        */
        if (
          next <= 22 &&
          next >= 10 &&
          !collisionHandledRef.current
        ) {
          collisionHandledRef.current = true;

          if (characterYRef.current < 70) {
            setLives((previousLives) => {
              const nextLives = previousLives - 1;

              if (nextLives <= 0) {
                setGameOver(true);
                setMessage("Challenge over");
              } else {
                setMessage("Obstacle hit! Try the next one.");
              }

              return Math.max(nextLives, 0);
            });
          } else {
            setGameScore((previousScore) => previousScore + 250);
            setMessage("Obstacle cleared! +250");
          }
        }

        /*
          Once the obstacle leaves the screen,
          send it back to the right.
        */
        if (next < -8) {
          next = 105;
          collisionHandledRef.current = false;

          setGameScore((previousScore) => previousScore + 50);
        }

        obstacleXRef.current = next;

        return next;
      });
    }, 16);

    return () => {
      window.clearInterval(timer);
    };
  }, [gameStarted, gameOver, bodyReady]);

  function startGame() {
    if (!bodyReady) {
      setMessage("Move your full body into the camera first");
      return;
    }

    setGameStarted(true);
    setGameOver(false);
    setGameScore(0);
    setLives(3);
    setObstacleX(100);

    obstacleXRef.current = 100;
    collisionHandledRef.current = false;

    setMessage("Squat to jump over the obstacle!");
  }

  function restartGame() {
    setGameStarted(false);
    setGameOver(false);
    setGameScore(0);
    setLives(3);
    setObstacleX(100);
    setCharacterY(0);

    obstacleXRef.current = 100;
    characterYRef.current = 0;
    jumpingRef.current = false;
    collisionHandledRef.current = false;

    setMessage("Ready for another run?");
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-400/20 bg-slate-950 shadow-2xl">
      {/* HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300">
            RehabVerse
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Movement Run
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Score
            </p>

            <p className="text-xl font-bold text-white">
              {gameScore}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Reps
            </p>

            <p className="text-xl font-bold text-white">
              {reps}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Lives
            </p>

            <p className="text-xl">
              {Array.from({ length: 3 }).map((_, index) => (
                <span
                  key={index}
                  className={
                    index < lives
                      ? "opacity-100"
                      : "opacity-20"
                  }
                >
                  💜
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      {/* Game world */}
      <div className="relative h-[470px] overflow-hidden bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950">
        {/* Moon / glowing planet */}
        <div className="absolute right-[10%] top-[10%] h-24 w-24 rounded-full bg-indigo-300/20 blur-sm" />

        <div className="absolute right-[11%] top-[11%] h-20 w-20 rounded-full bg-gradient-to-br from-indigo-200 to-purple-400 shadow-[0_0_60px_rgba(129,140,248,0.45)]" />

        {/* Stars */}
        <div className="absolute left-[8%] top-[12%] text-sm text-white/70">
          ✦
        </div>

        <div className="absolute left-[28%] top-[20%] text-xs text-white/50">
          ✦
        </div>

        <div className="absolute left-[45%] top-[9%] text-lg text-indigo-200/60">
          ✦
        </div>

        <div className="absolute left-[66%] top-[25%] text-xs text-white/60">
          ✦
        </div>

        <div className="absolute left-[88%] top-[32%] text-sm text-indigo-200/70">
          ✦
        </div>

        {/* Mountains */}
        <div className="absolute bottom-[76px] left-[-5%] h-44 w-[45%] rotate-6 bg-indigo-950/70 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />

        <div className="absolute bottom-[76px] left-[25%] h-56 w-[50%] bg-purple-950/70 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />

        <div className="absolute bottom-[76px] right-[-10%] h-48 w-[45%] -rotate-6 bg-indigo-950/80 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />

        {/* Instructions */}
        <div className="absolute left-1/2 top-6 z-20 -translate-x-1/2">
          <div className="rounded-full border border-white/10 bg-black/30 px-5 py-2 text-center text-sm text-indigo-100 backdrop-blur">
            {message}
          </div>
        </div>

        {/* Character */}
        <div
          className="absolute bottom-[78px] left-[14%] z-20 transition-[bottom] duration-300 ease-out"
          style={{
            bottom: `${78 + characterY}px`,
          }}
        >
          <div className="relative flex flex-col items-center">
            {/* head */}
            <div className="h-9 w-9 rounded-full border-2 border-cyan-200 bg-indigo-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />

            {/* body */}
            <div className="mt-1 h-12 w-8 rounded-lg bg-gradient-to-b from-cyan-300 to-indigo-500" />

            {/* legs */}
            <div className="flex gap-2">
              <div className="h-9 w-2 rotate-6 rounded-full bg-indigo-300" />
              <div className="h-9 w-2 -rotate-6 rounded-full bg-indigo-300" />
            </div>

            {/* glow */}
            <div className="absolute bottom-0 h-8 w-14 rounded-full bg-cyan-400/20 blur-lg" />
          </div>
        </div>

        {/* Obstacle */}
        {gameStarted && !gameOver && (
          <div
            className="absolute bottom-[76px] z-20"
            style={{
              left: `${obstacleX}%`,
            }}
          >
            <div className="relative">
              <div className="h-20 w-12 rounded-t-xl border border-purple-300/40 bg-gradient-to-b from-purple-500 to-indigo-800 shadow-[0_0_25px_rgba(168,85,247,0.4)]" />

              <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>
          </div>
        )}

        {/* Ground */}
        <div className="absolute bottom-0 h-[78px] w-full border-t border-indigo-300/30 bg-gradient-to-b from-indigo-900 to-slate-950">
          <div className="absolute top-3 h-px w-full bg-indigo-300/20" />

          <div className="absolute left-0 top-8 h-px w-full bg-purple-300/10" />
        </div>

        {/* Start overlay */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px]">
            <div className="max-w-md px-6 text-center">
              <div className="mb-4 text-5xl">
                🏃
              </div>

              <h2 className="text-3xl font-bold text-white">
                Movement Run
              </h2>

              <p className="mt-3 leading-7 text-slate-300">
                Your body is the controller. Complete a squat
                to make your character jump over incoming
                obstacles.
              </p>

              <div
                className={`mx-auto mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                  bodyReady
                    ? "bg-green-500/20 text-green-300"
                    : "bg-amber-500/20 text-amber-200"
                }`}
              >
                {bodyReady
                  ? "✓ Body tracking ready"
                  : "Waiting for full-body tracking"}
              </div>

              <div>
                <button
                  onClick={startGame}
                  disabled={!bodyReady}
                  className={`mt-6 rounded-xl px-7 py-3 font-semibold transition ${
                    bodyReady
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : "cursor-not-allowed bg-slate-700 text-slate-400"
                  }`}
                >
                  Start Run
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300">
                Session Complete
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                Run Complete
              </h2>

              <p className="mt-4 text-slate-300">
                Game score
              </p>

              <p className="mt-1 text-5xl font-bold text-cyan-300">
                {gameScore}
              </p>

              <button
                onClick={restartGame}
                className="mt-7 rounded-xl bg-indigo-500 px-7 py-3 font-semibold transition hover:bg-indigo-400"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}