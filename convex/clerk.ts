"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { createClerkClient } from "@clerk/backend"; // Named import of the function

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const createClerkUser = action({
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

export const deleteClerkUser = action({
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
