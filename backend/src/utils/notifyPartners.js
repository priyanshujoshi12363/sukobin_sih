// Push a freshly-available delivery job to every ONLINE partner whose currently-watched
// route corridor it falls on. Reuses the exact corridor + direction geometry the
// /route/match endpoint uses, so a partner only gets pinged for jobs they'd actually see.

import Partner from "../models/partner.model.js";
import { sendPush } from "./notification.js";
import { evaluateJob } from "./matching.js";

const ROUTE_TTL_MIN = Number(process.env.PARTNER_ROUTE_TTL_MIN) || 120;

/**
 * @param job { kind:'order'|'parcel', refId, type, fee, pickup:[lng,lat], drop:[lng,lat] }
 */
export async function notifyPartnersOfJob(job) {
  try {
    if (!Array.isArray(job?.pickup) || !Array.isArray(job?.drop)) return;

    const since = new Date(Date.now() - ROUTE_TTL_MIN * 60 * 1000);
    const partners = await Partner.find({
      isOnline: true,
      isBlocked: { $ne: true },
      expoPushToken: { $exists: true, $ne: null },
      "activeRoute.updatedAt": { $gte: since },
    })
      .select("expoPushToken activeRoute")
      .lean();

    if (!partners.length) return;

    const title = job.kind === "order" ? "New order on your route 📦" : "New parcel on your route 📦";

    let pushed = 0;
    for (const p of partners) {
      const ar = p.activeRoute;
      if (!Array.isArray(ar?.polyline) || ar.polyline.length < 2) continue;

      // same rule as the live list: city endpoints + 10 km mid-corridor + direction
      const ev = evaluateJob(job.pickup, job.drop, {
        polyline: ar.polyline,
        sDriver: 0,
        origin: ar.origin,
        destination: ar.destination,
        originRadiusKm: ar.originRadiusKm,
        destRadiusKm: ar.destRadiusKm,
      });
      if (!ev) continue;

      sendPush(p.expoPushToken, {
        title,
        body: `+₹${job.fee} · ${ev.offRouteKm} km off route · tap to grab it`,
        data: { type: "NEW_JOB", kind: job.kind, refId: job.refId, screen: "home" },
      });
      pushed++;
    }
    if (pushed) console.log(`🔔 ${job.kind} ${job.refId} → notified ${pushed} partner(s)`);
  } catch (e) {
    console.error("notifyPartnersOfJob error:", e.message);
  }
}
