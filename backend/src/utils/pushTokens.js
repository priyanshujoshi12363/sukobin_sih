import { tokenKind } from "./notification.js";

export function fieldsForToken(token, platform) {
  const kind = tokenKind(token);

  if (kind === "expo") {
    return { expoPushToken: token, pushPlatform: "expo" };
  }

  if (kind === "fcm") {
    return {
      fcmToken: token,
      pushPlatform: platform === "ios" ? "ios" : "android",
    };
  }

  return null;
}

export async function saveToken(Model, id, token, platform) {
  const update = fieldsForToken(token, platform);
  if (!update) return { ok: false, reason: `unrecognised token format` };

  await Model.updateMany(
    { _id: { $ne: id }, ...(update.fcmToken ? { fcmToken: update.fcmToken } : {}) },
    { $unset: { fcmToken: "" } }
  );

  const doc = await Model.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!doc) return { ok: false, reason: "account not found" };

  return { ok: true, kind: update.pushPlatform, doc };
}
