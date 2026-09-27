export type MovementPhase =
  | "waiting"
  | "ready"
  | "moving"
  | "returning";

export type MovementAttemptResult = {
  phase: MovementPhase;
  completedAttempt: boolean;

  startAngle: number | null;
  currentAngle: number;
  deepestAngle: number | null;

  rangeOfMotion: number;
  durationMs: number;

  feedback: string;
};

export type MovementEngineConfig = {
  // Minimum change from the starting position before we consider
  // the person to have intentionally started the movement.
  startDeltaDegrees: number;

  // Minimum total angle change required for an attempt to count.
  // This is NOT a clinical target or required squat depth.
  minimumAttemptRangeDegrees: number;

  // How close the person should return toward their starting
  // position before the attempt is considered complete.
  returnToleranceDegrees: number;

  // Prevent extremely fast tracking noise from becoming a rep.
  minimumAttemptDurationMs: number;

  // Reset an unfinished attempt if it lasts too long.
  maximumAttemptDurationMs: number;

  // Small tolerance used when deciding whether movement has
  // changed direction.
  reversalToleranceDegrees: number;
};

const DEFAULT_CONFIG: MovementEngineConfig = {
  startDeltaDegrees: 6,
  minimumAttemptRangeDegrees: 10,
  returnToleranceDegrees: 8,
  minimumAttemptDurationMs: 450,
  maximumAttemptDurationMs: 10000,
  reversalToleranceDegrees: 3,
};

export class MovementAttemptEngine {
  private config: MovementEngineConfig;

  private phase: MovementPhase = "waiting";

  private baselineAngle: number | null = null;
  private startAngle: number | null = null;
  private deepestAngle: number | null = null;
  private previousAngle: number | null = null;

  private attemptStartedAt: number | null = null;

  private readySamples: number[] = [];

  constructor(config: Partial<MovementEngineConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  process(
    angle: number,
    timestamp = performance.now()
  ): MovementAttemptResult {
    /*
      RehabVerse movement attempt model

      Example:

      165°
       ↓
      158°
       ↓
      151°
       ↑
      156°
       ↑
      162°

      We care about the movement pattern:

      start -> move -> reverse -> return

      We do NOT require a universal squat depth.
    */

    if (this.previousAngle === null) {
      this.previousAngle = angle;
    }

    /*
      Establish a short starting-position baseline.

      We collect several measurements instead of trusting one frame.
    */
    if (this.phase === "waiting") {
      this.readySamples.push(angle);

      if (this.readySamples.length > 12) {
        this.readySamples.shift();
      }

      if (this.readySamples.length >= 8) {
        const average =
          this.readySamples.reduce(
            (sum, value) => sum + value,
            0
          ) / this.readySamples.length;

        const variation =
          Math.max(...this.readySamples) -
          Math.min(...this.readySamples);

        /*
          A relatively stable set of samples becomes the
          person's observed starting position.

          This is a tracking baseline, NOT a clinical target.
        */
        if (variation <= 8) {
          this.baselineAngle = average;
          this.phase = "ready";
        }
      }

      this.previousAngle = angle;

      return this.result(
        angle,
        false,
        timestamp,
        "Hold your starting position for a moment."
      );
    }

    /*
      READY

      For knee flexion movements such as our current squat
      prototype, the knee angle becomes smaller as the person
      bends.

      Once the angle changes enough from the observed baseline,
      an intentional movement attempt begins.
    */
    if (this.phase === "ready") {
      if (this.baselineAngle === null) {
        this.reset();
        return this.result(
          angle,
          false,
          timestamp,
          "Finding your starting position."
        );
      }

      const movementDelta =
        this.baselineAngle - angle;

      if (
        movementDelta >=
        this.config.startDeltaDegrees
      ) {
        this.phase = "moving";

        this.startAngle = this.baselineAngle;
        this.deepestAngle = angle;
        this.attemptStartedAt = timestamp;

        this.previousAngle = angle;

        return this.result(
          angle,
          false,
          timestamp,
          "Movement detected — keep going at a comfortable pace."
        );
      }

      /*
        Slowly adapt the baseline while the person is standing
        naturally. This helps with small posture changes.
      */
      this.baselineAngle =
        this.baselineAngle * 0.9 + angle * 0.1;

      this.previousAngle = angle;

      return this.result(
        angle,
        false,
        timestamp,
        "Ready when you are."
      );
    }

    /*
      MOVING

      Track the greatest amount of knee flexion reached during
      this attempt.

      We call this "deepestAngle" internally because a smaller
      knee angle represents more flexion, but we do not tell the
      user they need to reach a particular depth.
    */
    if (this.phase === "moving") {
      if (
        this.deepestAngle === null ||
        angle < this.deepestAngle
      ) {
        this.deepestAngle = angle;
      }

      const elapsed =
        this.attemptStartedAt === null
          ? 0
          : timestamp - this.attemptStartedAt;

      if (
        elapsed >
        this.config.maximumAttemptDurationMs
      ) {
        this.cancelAttempt(angle);

        return this.result(
          angle,
          false,
          timestamp,
          "Let's reset your position and try again when you're ready."
        );
      }

      /*
        Detect reversal.

        During the downward/bending portion the knee angle
        decreases. When it begins increasing again by more than
        a small tolerance, the person has started returning.
      */
      if (
        this.deepestAngle !== null &&
        angle >=
          this.deepestAngle +
            this.config.reversalToleranceDegrees
      ) {
        this.phase = "returning";

        this.previousAngle = angle;

        return this.result(
          angle,
          false,
          timestamp,
          "Good — return toward your starting position."
        );
      }

      this.previousAngle = angle;

      return this.result(
        angle,
        false,
        timestamp,
        "Movement detected — keep going at a comfortable pace."
      );
    }

    /*
      RETURNING

      The person has reversed direction and is moving back
      toward their observed starting position.
    */
    if (this.phase === "returning") {
      const elapsed =
        this.attemptStartedAt === null
          ? 0
          : timestamp - this.attemptStartedAt;

      if (
        elapsed >
        this.config.maximumAttemptDurationMs
      ) {
        this.cancelAttempt(angle);

        return this.result(
          angle,
          false,
          timestamp,
          "Let's reset your position and try again when you're ready."
        );
      }

      const range =
        this.startAngle !== null &&
        this.deepestAngle !== null
          ? Math.max(
              0,
              this.startAngle -
                this.deepestAngle
            )
          : 0;

      const returnedNearStart =
        this.startAngle !== null &&
        angle >=
          this.startAngle -
            this.config.returnToleranceDegrees;

      if (returnedNearStart) {
        const longEnough =
          elapsed >=
          this.config.minimumAttemptDurationMs;

        const enoughMovement =
          range >=
          this.config.minimumAttemptRangeDegrees;

        if (longEnough && enoughMovement) {
          const completedResult =
            this.result(
              angle,
              true,
              timestamp,
              "Controlled movement completed."
            );

          /*
            Use the returned position as the next observed
            starting position so the engine can adapt naturally.
          */
          this.baselineAngle = angle;

          this.clearAttempt();

          this.phase = "ready";
          this.previousAngle = angle;

          return completedResult;
        }

        /*
          A tiny or extremely fast motion is treated as tracking
          noise / repositioning rather than a completed attempt.
        */
        this.baselineAngle = angle;

        this.clearAttempt();

        this.phase = "ready";
        this.previousAngle = angle;

        return this.result(
          angle,
          false,
          timestamp,
          "Ready for your next movement."
        );
      }

      /*
        If the person changes direction again before returning,
        continue tracking rather than immediately failing.
      */
      if (
        this.previousAngle !== null &&
        angle <
          this.previousAngle -
            this.config.reversalToleranceDegrees
      ) {
        this.phase = "moving";

        if (
          this.deepestAngle === null ||
          angle < this.deepestAngle
        ) {
          this.deepestAngle = angle;
        }

        this.previousAngle = angle;

        return this.result(
          angle,
          false,
          timestamp,
          "Movement detected — keep going at a comfortable pace."
        );
      }

      this.previousAngle = angle;

      return this.result(
        angle,
        false,
        timestamp,
        "Good — return toward your starting position."
      );
    }

    this.previousAngle = angle;

    return this.result(
      angle,
      false,
      timestamp,
      "Ready when you are."
    );
  }

  reset() {
    this.phase = "waiting";

    this.baselineAngle = null;
    this.startAngle = null;
    this.deepestAngle = null;
    this.previousAngle = null;

    this.attemptStartedAt = null;

    this.readySamples = [];
  }

  private clearAttempt() {
    this.startAngle = null;
    this.deepestAngle = null;
    this.attemptStartedAt = null;
  }

  private cancelAttempt(angle: number) {
    this.baselineAngle = angle;

    this.clearAttempt();

    this.phase = "ready";
    this.previousAngle = angle;
  }

  private result(
    currentAngle: number,
    completedAttempt: boolean,
    timestamp: number,
    feedback: string
  ): MovementAttemptResult {
    const rangeOfMotion =
      this.startAngle !== null &&
      this.deepestAngle !== null
        ? Math.max(
            0,
            this.startAngle -
              this.deepestAngle
          )
        : 0;

    const durationMs =
      this.attemptStartedAt !== null
        ? Math.max(
            0,
            timestamp -
              this.attemptStartedAt
          )
        : 0;

    return {
      phase: this.phase,
      completedAttempt,

      startAngle:
        this.startAngle ??
        this.baselineAngle,

      currentAngle,

      deepestAngle: this.deepestAngle,

      rangeOfMotion:
        Math.round(rangeOfMotion * 10) / 10,

      durationMs: Math.round(durationMs),

      feedback,
    };
  }
}