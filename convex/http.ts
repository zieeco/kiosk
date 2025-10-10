import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api"; // Import api and internal to reference internal actions

const http = httpRouter();

// Define HTTP endpoints
http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const header = request.headers.get("svix-id")!;
    const timestamp = request.headers.get("svix-timestamp")!;
    const signature = request.headers.get("svix-signature")!;

    // Call the internal action to handle the webhook
    await (ctx as any).runAction(internal.clerk.handleClerkWebhook, { // Corrected to internal.clerk.handleClerkWebhook
      payload: payloadString,
      headers: {
        svix_id: header, // Changed from "svix-id" to svix_id
        svix_timestamp: timestamp, // Changed from "svix-timestamp" to svix_timestamp
        svix_signature: signature, // Changed from "svix-signature" to svix_signature
      },
    });

    return new Response(null, {
      status: 200,
    });
  }),
});

export default http;
