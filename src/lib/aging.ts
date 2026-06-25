import { AgingStage, Project, ProjectView, Settings } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now.getTime() - then) / MS_PER_DAY);
}

export function isSnoozed(p: Project, now: Date = new Date()): boolean {
  if (!p.snoozeUntil) return false;
  return new Date(p.snoozeUntil).getTime() > now.getTime();
}

// A snoozed card whose window has elapsed: it should "bubble up" again.
export function hasWoken(p: Project, now: Date = new Date()): boolean {
  if (p.lane !== "snooze") return false;
  if (!p.snoozeUntil) return true;
  return new Date(p.snoozeUntil).getTime() <= now.getTime();
}

export function agingStage(
  p: Project,
  settings: Settings,
  now: Date = new Date()
): AgingStage {
  if (isSnoozed(p, now)) return "snoozed";
  const d = daysSince(p.lastTouched, now);
  if (d >= settings.staleAfterDays) return "stale";
  if (d >= settings.warmAfterDays) return "warm";
  return "fresh";
}

// Enrich a stored project with computed presentation fields.
export function toProjectView(
  p: Project,
  settings: Settings,
  now: Date = new Date()
): ProjectView {
  return {
    ...p,
    agingStage: agingStage(p, settings, now),
    daysUntouched: Math.floor(daysSince(p.lastTouched, now)),
    woke: hasWoken(p, now),
  };
}
