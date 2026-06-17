/**
 * Secured batch trigger for the prediction engine (Roost v2).
 * POST /internal/predict with header `x-cron-secret: $CRON_SECRET`.
 *
 * The in-process scheduler (cron.server.ts) runs this automatically every night;
 * this endpoint lets an external scheduler or an operator drive the same batch
 * on demand. No Shopify auth — it's a server-to-server job guarded by a shared secret.
 */
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { runPredictionBatch } from "../models/predictionActions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return data({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPredictionBatch(new Date());
  return data({ ok: true, ...result });
};
