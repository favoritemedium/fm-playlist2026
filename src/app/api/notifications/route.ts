import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { jsonRouteError, jsonValidationError } from "@/lib/api-route-errors";
import { fetchNotifications, markNotificationRead } from "@/lib/notifications-db";
import { positiveIntegerParamSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { appAuth, response } = await authorizeApiRequest();
    if (response) return response;
    return NextResponse.json({ notifications: await fetchNotifications(appAuth.user.id) });
  } catch (error) {
    return jsonRouteError(error, "Failed to fetch notifications:", "Failed to fetch notifications", "FETCH_NOTIFICATIONS_FAILED");
  }
}

export async function PATCH(request: Request) {
  try {
    const { appAuth, response } = await authorizeApiRequest();
    if (response) return response;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonValidationError("Invalid JSON body", "INVALID_JSON", []);
    }

    if (!body || typeof body !== "object") {
      return jsonValidationError("Invalid notification update", "INVALID_NOTIFICATION_INPUT", []);
    }

    const idValue = "id" in body ? body.id : null;
    if (idValue === null || idValue === undefined) {
      await markNotificationRead(appAuth.user.id, null);
      return NextResponse.json({ ok: true });
    }

    const parsedId = positiveIntegerParamSchema.safeParse(idValue);
    if (!parsedId.success) {
      return jsonValidationError("Invalid notification ID", "INVALID_NOTIFICATION_ID", parsedId.error.issues);
    }

    await markNotificationRead(appAuth.user.id, parsedId.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRouteError(error, "Failed to update notification:", "Failed to update notification", "UPDATE_NOTIFICATION_FAILED");
  }
}
