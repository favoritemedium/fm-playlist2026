import { authorizeApiRequest } from "@/lib/api-auth";
import { subscribeToEngagementEvents } from "@/lib/engagement-events";
import { syncAppUserIdentity } from "@/lib/users-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeSseMessage(eventName: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

function encodeSseComment(comment: string): Uint8Array {
  return new TextEncoder().encode(`: ${comment}\n\n`);
}

export async function GET() {
  const { appAuth, response } = await authorizeApiRequest();
  if (response) return response;

  await syncAppUserIdentity(appAuth.user);

  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeSseComment("connected"));

      cleanup = subscribeToEngagementEvents((event) => {
        if (
          event.type === "song_comment_notification" &&
          event.recipientUserId !== appAuth.user.id &&
          event.songSubmitterUserId !== appAuth.user.id
        ) {
          return;
        }

        try {
          controller.enqueue(encodeSseMessage(event.type, event));
        } catch {
          cleanup?.();
        }
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encodeSseComment("ping"));
        } catch {
          cleanup?.();
        }
      }, 25000);
    },
    cancel() {
      cleanup?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
