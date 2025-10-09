import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api"; // Import api to reference internal actions

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
    await (ctx as any).runAction(api.auth.loggedInUser, {
      payload: payloadString,
      headers: {
        "svix-id": header,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      },
    });

    return new Response(null, {
      status: 200,
    });
  }),
});

export default http;
