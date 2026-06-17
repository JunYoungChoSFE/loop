/**
 * In-process nightly scheduler for the prediction batch (Roost v2).
 *
 * Why in-process: the app runs as a single always-on Fly machine
 * (min_machines_running = 1, auto_stop = false), so a self-rearming daily timer
 * is enough — no separate Python worker, cron container, or scheduled machine
 * (PREDICTION_SPEC section 5, adapted to this deploy). The batch is also exposed
 * as a secured HTTP endpoint (routes/internal.predict.tsx) so an external
 * scheduler can drive it if ever needed, and so it's testable.
 *
 * Safety: a process-global guard prevents double-arming across module copies,
 * and a per-day marker prevents a second full run if the machine restarts.
 * Disable entirely with DISABLE_PREDICTION_CRON=1.
 */
import { runPredictionBatch } from "./models/predictionActions.server";

const RUN_HOUR_UTC = 2; // ~daily at 02:00 UTC (off-peak for KST stores)
const DAY_MS = 24 * 60 * 60 * 1000;

const GLOBAL_KEY = "__loopPredictionScheduler__";

interface SchedulerState {
  armed: boolean;
  lastRunYmd: string | null;
}

function state(): SchedulerState {
  const g = globalThis as unknown as Record<string, SchedulerState | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { armed: false, lastRunYmd: null };
  return g[GLOBAL_KEY]!;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Milliseconds from `now` until the next RUN_HOUR_UTC. */
function msUntilNextRun(now: Date): number {
  const next = new Date(now);
  next.setUTCHours(RUN_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
}

async function runOnce(): Promise<void> {
  const s = state();
  const today = ymd(new Date());
  if (s.lastRunYmd === today) return; // already ran today (e.g. after a restart)
  s.lastRunYmd = today;
  try {
    const res = await runPredictionBatch(new Date());
    console.log(
      `[predict] nightly batch: ${res.shops} shops, ${res.predicted} predicted, ` +
        `${res.reminders} reminders, ${res.winbacks} winbacks, ${res.highValueAlerts} alerts`,
    );
  } catch (e) {
    console.log("[predict] nightly batch error:", e);
  }
}

function scheduleNext(): void {
  const delay = msUntilNextRun(new Date());
  const t = setTimeout(async () => {
    await runOnce();
    scheduleNext();
  }, delay);
  // Don't keep the event loop alive solely for the timer.
  if (typeof t.unref === "function") t.unref();
}

/** Arm the daily scheduler exactly once per process. Idempotent. */
export function startPredictionScheduler(): void {
  if (process.env.DISABLE_PREDICTION_CRON === "1") return;
  const s = state();
  if (s.armed) return;
  s.armed = true;
  console.log(`[predict] scheduler armed — next run ~${RUN_HOUR_UTC}:00 UTC daily`);
  scheduleNext();
}
