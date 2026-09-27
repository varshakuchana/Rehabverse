"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { NovaMark } from "@/components/NovaMark";
import DemoFigure, { type DemoKind } from "@/components/DemoFigure";

/*
  The full-screen session stage: the world fills the screen and everything
  else floats over it, readable from across the room. Pure layout. Session
  owners pass in their own state, handlers and world.
*/

export function Stage({ accent, world, children, label, plain = false }: { accent: string; world: ReactNode; children: ReactNode; label: string; plain?: boolean }) {
  return (
    <main id="main-content" tabIndex={-1} aria-label={label}
      className="rv-stage relative isolate h-[100svh] min-h-[640px] w-full overflow-hidden bg-[#161A30] text-[#F4F6F2]"
      style={{ "--rv-accent": accent } as CSSProperties}>
      <div className="absolute inset-0 -z-10">{world}</div>
      {!plain && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-[5] h-48 bg-gradient-to-b from-[rgba(18,20,40,.55)] to-transparent" />}
      {!plain && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-[5] h-64 bg-gradient-to-t from-[rgba(18,20,40,.6)] to-transparent" />}
      {children}
    </main>
  );
}

export function StageTopBar({ backHref, backLabel, onBack, context }: { backHref: string; backLabel: string; onBack?: (e: MouseEvent<HTMLAnchorElement>) => void; context: string }) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-5 pt-4 text-[15px]">
      <Link href={backHref} onClick={onBack} className="rounded-full bg-[rgba(24,28,54,.55)] px-4 py-2 backdrop-blur-md transition hover:bg-[rgba(24,28,54,.85)]">
        <span aria-hidden>←</span> {backLabel}
      </Link>
      <p className="hidden rounded-full bg-[rgba(24,28,54,.55)] px-4 py-2 opacity-90 backdrop-blur-md sm:block">{context}</p>
    </div>
  );
}

export function StageCoach({ eyebrow, quest, title, hint, note, nova, demo, accent, extra }: {
  eyebrow: string; quest: string; title: string; hint: string; note?: string;
  nova?: ReactNode; demo?: DemoKind | null; accent: string; extra?: ReactNode;
}) {
  return (
    <section aria-label="Coaching" className="absolute left-5 top-16 z-10 flex max-w-[min(62%,660px)] items-stretch gap-4 rounded-[26px] border border-white/20 bg-[rgba(24,28,54,.78)] py-4 pl-6 pr-4 backdrop-blur-md">
      <div className="min-w-0">
        <p className="text-[15px]"><span className="opacity-70">{eyebrow}: </span><span className="font-semibold" style={{ color: accent }}>{quest}</span></p>
        <h1 aria-live="polite" className="font-display text-[clamp(30px,3.5vw,50px)] font-extrabold leading-[1.02] tracking-tight">{title}</h1>
        <p className="mt-1 text-[18px] leading-snug opacity-90">{hint}</p>
        {note && <p className="mt-2 text-[15px] opacity-65">{note}</p>}
        {extra}
        {nova && <div className="mt-3 flex items-start gap-2.5 border-t border-white/15 pt-3"><NovaMark size={30} /><div className="min-w-0 flex-1">{nova}</div></div>}
      </div>
      {demo && (
        <div className="hidden shrink-0 items-center border-l border-white/15 pl-3 md:flex">
          <DemoFigure demo={demo} accent={accent} size={96} />
        </div>
      )}
    </section>
  );
}

export function StagePip({ children }: { children: ReactNode }) {
  return <div className="absolute right-5 top-16 z-10 aspect-video w-[clamp(200px,24vw,360px)] overflow-hidden rounded-2xl border-2 border-white/25 bg-[#151A2E] shadow-2xl">{children}</div>;
}

export function StageCounter({ value, target, unit, bumpKey, extra }: { value: number; target: number; unit: string; bumpKey?: number; extra?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-6 z-10 flex items-end gap-6 [text-shadow:0_3px_0_rgba(30,34,64,.3),0_10px_34px_rgba(20,22,45,.65)]">
      <div role="status" aria-label={`${value} of ${target} ${unit}`}>
        <p aria-hidden className="ml-1 font-display text-xl font-semibold">{unit}</p>
        <p aria-hidden className="font-display leading-[.84]">
          <span key={bumpKey ?? value} className="inline-block text-[clamp(104px,21vh,240px)] font-extrabold tracking-[-0.05em] tabular-nums motion-safe:animate-[rvbump_.5s_cubic-bezier(.2,1.6,.4,1)]">{value}</span>
          <span className="ml-2 text-[clamp(34px,6vh,70px)] font-semibold opacity-80">/{target}</span>
        </p>
      </div>
      {extra}
    </div>
  );
}

export function StageActions({ children }: { children: ReactNode }) {
  return <div className="absolute bottom-6 right-5 z-10 flex max-w-[62%] flex-wrap items-center justify-end gap-3">{children}</div>;
}

export const stageBtn = "min-h-14 rounded-full border-2 border-white/50 bg-[rgba(24,28,54,.72)] px-6 font-display text-base font-semibold backdrop-blur-md transition hover:bg-[rgba(24,28,54,.92)] disabled:cursor-not-allowed disabled:opacity-45";

export function StagePrimary({ onClick, disabled, children, accent, ink, big }: { onClick: () => void; disabled?: boolean; children: ReactNode; accent: string; ink: string; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded-full font-display font-bold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 ${big ? "min-h-16 px-9 text-xl" : "min-h-14 px-7 text-lg"}`}
      style={{ background: accent, color: ink }}>
      {children}
    </button>
  );
}

export function StageCountdown({ value, accent }: { value: number | string; accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <p key={String(value)} className="font-display text-[clamp(120px,26vh,280px)] font-extrabold leading-none [text-shadow:0_8px_40px_rgba(20,22,45,.7)] motion-safe:animate-[rvrise_.8s_cubic-bezier(.2,.8,.2,1)_both]" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

export function StageCenter({ children }: { children: ReactNode }) {
  return <div className="absolute inset-x-0 top-[44%] z-10 grid place-items-center px-4">{children}</div>;
}

export function StagePanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[rgba(18,21,42,.4)] p-4">
      <div className="max-h-[92%] w-full max-w-[540px] overflow-auto rounded-[28px] border border-white/20 bg-[rgba(24,28,54,.9)] p-7 backdrop-blur-md motion-safe:animate-[rvrise_.6s_cubic-bezier(.2,.8,.2,1)_both]">{children}</div>
    </div>
  );
}
