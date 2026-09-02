import { Expo } from "expo-server-sdk";
import admin, { firebaseReady } from "../config/firebaseAdmin.js";

const expo = new Expo();

export const CHANNEL_ID = "sukobin_alerts";
export const SOUND_FILE = "notification.wav";
export const SOUND_RES = "notification";

export function tokenKind(token) {
  if (!token || typeof token !== "string") return "none";
  if (Expo.isExpoPushToken(token)) return "expo";
  if (token.length > 60 && !token.includes(" ")) return "fcm";
  return "unknown";
}

function stringifyData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

async function sendExpo(tokens, { title, body, data }) {
  const messages = tokens.map((to) => ({
    to,
    sound: SOUND_FILE,
    title,
    body,
    data: data || {},
    priority: "high",
    channelId: CHANNEL_ID,
  }));

  const tickets = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    } catch (error) {
      console.error("Expo push error:", error.message);
    }
  }
  return { transport: "expo", sent: tickets.length, tickets };
}

async function sendFcm(tokens, { title, body, data }) {
  if (!firebaseReady()) {
    return { transport: "fcm", skipped: true, reason: "firebase not configured" };
  }

  const message = {
    notification: { title, body },
    data: stringifyData(data),
    android: {
      priority: "high",
      notification: {
        channelId: CHANNEL_ID,
        sound: SOUND_RES,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      payload: { aps: { sound: SOUND_FILE, contentAvailable: true } },
    },
  };

  try {
    const res = await admin.messaging().sendEachForMulticast({ ...message, tokens });
    const invalid = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-argument")
        ) {
          invalid.push(tokens[i]);
        }
      }
    });
    return {
      transport: "fcm",
      sent: res.successCount,
      failed: res.failureCount,
      invalidTokens: invalid,
    };
  } catch (error) {
    console.error("FCM push error:", error.message);
    return { transport: "fcm", error: error.message };
  }
}

export async function sendPush(token, payload = {}) {
  const kind = tokenKind(token);
  if (kind === "expo") return sendExpo([token], payload);
  if (kind === "fcm") return sendFcm([token], payload);
  return { skipped: true, reason: `unrecognised token (${kind})` };
}

export async function sendPushMany(tokens, payload = {}) {
  const clean = [...new Set((tokens || []).filter(Boolean))];
  const expoTokens = clean.filter((t) => tokenKind(t) === "expo");
  const fcmTokens = clean.filter((t) => tokenKind(t) === "fcm");

  const results = [];
  if (expoTokens.length) results.push(await sendExpo(expoTokens, payload));
  if (fcmTokens.length) results.push(await sendFcm(fcmTokens, payload));

  return {
    targeted: clean.length,
    skipped: clean.length - expoTokens.length - fcmTokens.length,
    results,
  };
}

export function tokensOf(doc) {
  if (!doc) return [];
  return [doc.fcmToken, doc.expoPushToken].filter(Boolean);
}

export async function notify(doc, payload = {}) {
  const tokens = tokensOf(doc);
  if (!tokens.length) return { skipped: true, reason: "no token on record" };
  return sendPushMany([tokens[0]], payload);
}

export async function pruneInvalidTokens(Model, invalidTokens) {
  if (!invalidTokens?.length) return 0;
  const res = await Model.updateMany(
    { fcmToken: { $in: invalidTokens } },
    { $unset: { fcmToken: "" } }
  );
  return res.modifiedCount || 0;
}

export async function sendHelloNotification(token) {
  const kind = tokenKind(token);
  if (kind === "none" || kind === "unknown") {
    throw new Error("Invalid push token");
  }
  return sendPush(token, {
    title: "Hello Sukobin!",
    body: "This is a test notification from Sukobin.",
    data: { screen: "home" },
  });
}
