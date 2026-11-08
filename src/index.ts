import app, { type Bindings } from './app';
import { createHealthMonitorDb } from './db/health-monitor/client';
import { shiftDemoDates } from './db/health-monitor/demo-shift.repository';

// Daily Cron Trigger (wrangler.jsonc "0 0 * * *"): shifts the Health Monitor
// demo dates forward by whole elapsed days (v4.2-plan.md Decisions 15-16, ADR-015).
async function runDemoDateShift(env: Bindings, scheduledTime: number): Promise<void> {
  try {
    const days = await shiftDemoDates(
      createHealthMonitorDb(env.HEALTH_MONITOR_DB),
      new Date(scheduledTime),
    );
    console.log(JSON.stringify({ event: 'demo-date-shift', days }));
  } catch (err) {
    console.error(JSON.stringify({ event: 'demo-date-shift', status: 'failed' }), err);
    // Rethrow so Cloudflare records the run as failed; the next daily run catches up.
    throw err;
  }
}

export default {
  fetch: app.fetch,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runDemoDateShift(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Bindings>;
