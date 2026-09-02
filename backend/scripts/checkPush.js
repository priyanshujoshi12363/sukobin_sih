import "dotenv/config";
import admin, { firebaseReady, firebaseProjectId } from "../src/config/firebaseAdmin.js";
import { tokenKind, sendPush, CHANNEL_ID, SOUND_RES } from "../src/utils/notification.js";
import { fieldsForToken } from "../src/utils/pushTokens.js";

const FAKE_FCM = "d" + "K".repeat(30) + ":APA91b" + "X".repeat(100);
const FAKE_EXPO = "ExponentPushToken[abcdefghijklmnopqrst]";

async function main() {
  console.log("firebase configured :", firebaseReady());
  console.log("project             :", firebaseProjectId);
  console.log("channel / sound     :", CHANNEL_ID, "/", SOUND_RES);

  console.log("\ntoken classification");
  for (const [label, t] of [
    ["expo", FAKE_EXPO],
    ["fcm", FAKE_FCM],
    ["garbage", "not a token"],
    ["empty", ""],
  ]) {
    const kind = tokenKind(t);
    const fields = fieldsForToken(t, "android");
    console.log(
      `  ${label.padEnd(9)} -> kind=${kind.padEnd(8)} stores=${fields ? Object.keys(fields).join("+") : "REJECTED"}`
    );
  }

  console.log("\nlive FCM auth check (sending to a deliberately invalid token)");
  try {
    await admin.messaging().send({
      token: FAKE_FCM,
      notification: { title: "probe", body: "probe" },
    });
    console.log("  unexpected success");
  } catch (e) {
    const code = e.errorInfo?.code || e.code || "";
    const authFailure =
      code.includes("authentication") ||
      code.includes("credential") ||
      code.includes("permission-denied") ||
      /invalid_grant|unauthorized/i.test(e.message || "");

    if (authFailure) {
      console.log("  CREDENTIALS REJECTED ->", code, e.message?.slice(0, 120));
      console.log("  FCM chain is NOT working");
    } else {
      console.log("  FCM rejected the token, not our credentials ->", code);
      console.log("  auth works: real device tokens will deliver");
    }
  }

  console.log("\nrouting check (no network calls for unknown tokens)");
  console.log("  garbage ->", JSON.stringify(await sendPush("nope", { title: "x", body: "y" })));
  console.log("  null    ->", JSON.stringify(await sendPush(null, { title: "x", body: "y" })));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
