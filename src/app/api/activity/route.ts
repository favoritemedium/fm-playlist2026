import { NextResponse } from "next/server";
import { fetchRecentActivity } from "@/lib/activity-db";
import { jsonRouteError } from "@/lib/api-route-errors";

export async function GET() {
  try {
    return NextResponse.json({ activity: await fetchRecentActivity() });
  } catch (error) {
    return jsonRouteError(error, "Failed to fetch activity:", "Failed to fetch activity", "FETCH_ACTIVITY_FAILED");
  }
}
