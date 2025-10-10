"use node";
import { action, internalAction } from "./_generated/server"; // Added internalAction
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend"; // Named import of the function
import { Webhook } from "svix"; // Import Svix
// import { WebhookEvent } from "svix"; // WebhookEvent is not exported directly from svix
// Using 'any' for msg type for now to unblock TypeScript errors

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Internal action to handle Clerk webhooks
export const handleClerkWebhook = internalAction({
  args: {
    payload: v.string(),
    headers: v.object({
      svix_id: v.string(), // Changed from "svix-id" to svix_id
      svix_timestamp: v.string(), // Changed from "svix-timestamp" to svix_timestamp
      svix_signature: v.string(), // Changed from "svix-signature" to svix_signature
    }),
  },
  handler: async (ctx, args) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("CLERK_WEBHOOK_SECRET is not set in environment variables.");
    }

    const wh = new Webhook(webhookSecret);
    let msg: any; // Using 'any' for msg type for now
    try {
      msg = wh.verify(args.payload, args.headers);
    } catch (err) {
      console.error("Error verifying webhook:", err);
      throw new Error("Invalid webhook signature");
    }

    // Process the webhook event
    const eventType = msg.type;
    switch (eventType) {
      case "user.created":
        console.log("Clerk user created:", msg.data.id);
        // Here you would typically sync user data to your Convex 'users' or 'employees' table
        // For now, just log it.
        break;
      case "user.deleted":
        console.log("Clerk user deleted:", msg.data.id);
        // Here you would typically delete user data from your Convex tables
        break;
      // Add more cases for other event types as needed (e.g., user.updated)
      default:
        console.log("Unhandled Clerk webhook event type:", eventType);
        break;
    }

    return { success: true };
  },
});

export const createClerkUser = internalAction({ // Changed to internalAction
  args: {
    email: v.string(),
    password: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await clerk.users.createUser({
        emailAddress: [args.email],
        password: args.password,
        firstName: args.firstName,
        lastName: args.lastName,
        skipPasswordChecks: true, // Temporarily skip for initial setup, consider removing in production
      });
      return { clerkUserId: user.id, email: user.emailAddresses[0].emailAddress };
    } catch (error) {
      console.error("Error creating Clerk user:", error);
      throw new Error(`Failed to create Clerk user: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

export const deleteClerkUser = internalAction({ // Changed to internalAction
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await clerk.users.deleteUser(args.clerkUserId);
      return { success: true };
    } catch (error) {
      console.error("Error deleting Clerk user:", error);
      throw new Error(`Failed to delete Clerk user: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
