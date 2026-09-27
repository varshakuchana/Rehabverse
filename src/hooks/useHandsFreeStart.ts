"use client";

import { isNovaPanelOpen, novaAudioBlocksVoiceStart } from "@/lib/novaAudioGate";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      0: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;

  start: () => void;
  stop: () => void;

  onstart: (() => void) | null;
  onend: (() => void) | null;

  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;

  onerror:
    | ((event: SpeechRecognitionErrorEventLike) => void)
    | null;
};

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type SessionState =
  | "positioning"
  | "ready"
  | "countdown"
  | "active"
  | "complete";

type InternalSessionState =
  | "idle"
  | "countdown"
  | "active"
  | "complete";

type UseHandsFreeStartOptions = {
  /*
    IMPORTANT:

    trackingReady should mean that the landmarks
    required for the CURRENT exercise are visible.

    It should NOT mean "the patient's entire body
    must be visible."

    Examples:

    Squat:
      hips + knees + ankles

    Shoulder exercise:
      shoulders + relevant arm landmarks

    Hand exercise:
      hand/wrist/arm landmarks needed by that
      specific exercise
  */
  trackingReady: boolean;

  countdownSeconds?: number;

  onSessionStart?: () => void;
};

function getSpeechRecognitionConstructor():
  | SpeechRecognitionConstructor
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.SpeechRecognition ??
    window.webkitSpeechRecognition
  );
}

export function useHandsFreeStart({
  trackingReady,
  countdownSeconds = 3,
  onSessionStart,
}: UseHandsFreeStartOptions) {
  /*
    "positioning" and "ready" do not need their
    own stored state.

    When the controller is idle:
      trackingReady = false -> positioning
      trackingReady = true  -> ready

    This avoids synchronously setting React state
    inside an effect.
  */
  const [
    internalState,
    setInternalState,
  ] = useState<InternalSessionState>("idle");

  const [countdown, setCountdown] =
    useState<number | null>(null);

  const [
    voiceListening,
    setVoiceListening,
  ] = useState(false);

  const [
    microphoneError,
    setMicrophoneError,
  ] = useState("");

  const trackingReadyRef =
    useRef(trackingReady);

  const internalStateRef =
    useRef<InternalSessionState>("idle");

  const onSessionStartRef =
    useRef(onSessionStart);

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(
      null
    );

  const recognitionRunningRef = useRef(false);
  const novaPanelOpenRef = useRef(isNovaPanelOpen());
  const resumeAfterNovaRef = useRef(false);

  const countdownTimerRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  /*
    Derive the public state instead of copying
    trackingReady into another React state.
  */
  const sessionState: SessionState =
    internalState === "idle"
      ? trackingReady
        ? "ready"
        : "positioning"
      : internalState;

  /*
    Browser support can also be derived directly.
  */
  const voiceSupported = Boolean(
    getSpeechRecognitionConstructor()
  );

  useEffect(() => {
    trackingReadyRef.current =
      trackingReady;
  }, [trackingReady]);

  useEffect(() => {
    internalStateRef.current =
      internalState;
  }, [internalState]);

  useEffect(() => {
    onSessionStartRef.current =
      onSessionStart;
  }, [onSessionStart]);

  const clearCountdown =
    useCallback(() => {
      if (
        countdownTimerRef.current !== null
      ) {
        clearInterval(
          countdownTimerRef.current
        );

        countdownTimerRef.current =
          null;
      }

      setCountdown(null);
    }, []);

  // Pose callbacks report loss immediately, including between timer ticks.
  const reportTrackingLost = useCallback(() => {
    trackingReadyRef.current = false;
    if (internalStateRef.current === "countdown") {
      clearCountdown();
      internalStateRef.current = "idle";
      setInternalState("idle");
    }
  }, [clearCountdown]);

  const isSessionActive = useCallback(
    () => internalStateRef.current === "active",
    []
  );

  /*
    This function can be called by:

    1. Voice command
    2. Manual Start button

    Later we could add another accessible input
    without changing the actual session logic.
  */
  const startSession =
    useCallback(() => {
      /*
        Do not start until the landmarks required
        for THIS exercise are visible.
      */
      if (!trackingReadyRef.current) {
        return;
      }

      /*
        Prevent duplicate countdowns or accidental
        restarts while a session is already active.
      */
      if (internalStateRef.current !== "idle") {
        return;
      }

      clearCountdown();

      internalStateRef.current =
        "countdown";

      setInternalState("countdown");

      let remaining =
        countdownSeconds;

      setCountdown(remaining);

      countdownTimerRef.current =
        setInterval(() => {
          /*
            If required tracking disappears before
            GO, cancel the countdown.

            For the squat detector this means the
            hip/knee/ankle landmarks needed for the
            knee-angle calculation disappeared.

            It does NOT mean every body landmark
            must be visible.
          */
          if (
            !trackingReadyRef.current
          ) {
            clearCountdown();

            internalStateRef.current =
              "idle";

            setInternalState("idle");

            return;
          }

          remaining -= 1;

          if (remaining <= 0) {
            clearCountdown();

            internalStateRef.current =
              "active";

            setInternalState("active");

            onSessionStartRef.current?.();

            return;
          }

          setCountdown(remaining);
        }, 1000);
    }, [
      clearCountdown,
      countdownSeconds,
    ]);

  /*
    Configure browser speech recognition.

    This is VOICE INPUT:
      Patient says "Start"
                ↓
      Browser recognizes command
                ↓
      RehabVerse begins countdown

    Nova speech output is handled separately by useNovaVoice.
  */
  useEffect(() => {
    const SpeechRecognition =
      getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    /*
      React state updates here happen in response
      to an external browser event, rather than
      synchronously inside the effect.
    */
    recognition.onstart = () => {
      recognitionRunningRef.current = true;
      setVoiceListening(true);
      setMicrophoneError("");
    };

    recognition.onresult = (
      event
    ) => {
      const latestResult =
        event.results[
          event.results.length - 1
        ];

      const transcript =
        latestResult?.[0]?.transcript
          ?.trim()
          .toLowerCase() ?? "";

      if (!transcript) {
        return;
      }

      /*
        Keep the command vocabulary small to
        reduce accidental starts.

        We intentionally do NOT use a generic
        word such as "go" right now.
      */
      const isStartCommand =
        /\b(start|begin)\b/.test(transcript);

      if (
        isStartCommand &&
        !novaAudioBlocksVoiceStart() &&
        !novaPanelOpenRef.current &&
        trackingReadyRef.current &&
        internalStateRef.current ===
          "idle"
      ) {
        startSession();
      }
    };

    recognition.onerror = (
      event
    ) => {
      setVoiceListening(false);
      setMicrophoneError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission is unavailable. You can still use the Start button."
          : `Voice recognition error: ${event.error}. Try Enable voice or use Start.`
      );
    };

    recognition.onend = () => {
      recognitionRunningRef.current = false;
      setVoiceListening(false);
      if (resumeAfterNovaRef.current && !novaPanelOpenRef.current) window.dispatchEvent(new CustomEvent("nova-panel", { detail: false }));
    };

    recognitionRef.current =
      recognition;

    // Configure once here; start from Enable Camera or Enable voice so
    // recognition begins inside a user interaction, not during mount.
    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognitionRunningRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      recognitionRef.current = null;
    };
  }, [startSession]);

  /*
    Allows the UI to provide something like:

      "Enable voice"

    or

      "Try microphone again"

    if the browser stops listening.
  */
  const restartVoiceListening =
    useCallback(() => {
      const recognition =
        recognitionRef.current;

      if (!recognition) {
        setMicrophoneError("Voice unavailable. You can still use the Start button.");
        return;
      }

      // Cover both starting and listening: repeated clicks must not start
      // the same recognition instance twice before Chrome fires onstart.
      if (recognitionRunningRef.current || novaPanelOpenRef.current) return;

      setMicrophoneError("");
      recognitionRunningRef.current = true;
      try {
        recognition.start();
      } catch (error) {
        recognitionRunningRef.current = false;
        setVoiceListening(false);
        setMicrophoneError(
          `Voice could not start: ${error instanceof Error ? error.message : "unknown error"}. Try Enable voice or use Start.`
        );
      }
    }, []);

  // Nova's question microphone owns speech input only while its panel is open.
  // The session Start/Begin recognizer resumes only if it was already enabled.
  useEffect(() => {
    const panel = (event: Event) => {
      const open = (event as CustomEvent<boolean>).detail;
      novaPanelOpenRef.current = open;
      if (open) {
        resumeAfterNovaRef.current = recognitionRunningRef.current;
        try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ }
      } else if (resumeAfterNovaRef.current && !recognitionRunningRef.current) {
        resumeAfterNovaRef.current = false;
        restartVoiceListening();
      }
    };
    window.addEventListener("nova-panel", panel);
    return () => window.removeEventListener("nova-panel", panel);
  }, [restartVoiceListening]);

  /*
    Call this when the prescribed exercise/set
    has been completed.
  */
  const completeSession =
    useCallback(() => {
      clearCountdown();

      internalStateRef.current =
        "complete";

      setInternalState("complete");
    }, [clearCountdown]);

  /*
    Full session-state reset.

    The squat page/game will also reset its own:
      reps
      score
      movement engine
      game world

    Then this controller returns to:
      POSITIONING
    or
      READY

    depending on current tracking.
  */
  const resetSession =
    useCallback(() => {
      clearCountdown();

      internalStateRef.current =
        "idle";

      setInternalState("idle");

    }, [clearCountdown]);

  /*
    Clean up a countdown if the page/component
    disappears.
  */
  useEffect(() => {
    return () => {
      if (
        countdownTimerRef.current !== null
      ) {
        clearInterval(
          countdownTimerRef.current
        );
      }
    };
  }, []);

  return {
    /*
      Session
    */
    sessionState,
    countdown,

    /*
      Voice
    */
    voiceSupported,
    voiceListening,
    microphoneError,

    /*
      Controls
    */
    startSession,
    reportTrackingLost,
    isSessionActive,
    completeSession,
    resetSession,
    restartVoiceListening,
  };
}
