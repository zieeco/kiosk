import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Check if any admin exists in the system
export const hasAdminUser = query({
  args: {},
  handler: async (ctx) => {
    const adminRole = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    return adminRole !== null;
  },
});

// Create the first admin user (only works if no admin exists)
export const createFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if any admin already exists
    const existingAdmin = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (existingAdmin) {
      throw new Error("An admin user already exists");
    }

    // Create admin role for this user
    await ctx.db.insert("roles", {
      userId,
      role: "admin",
      locations: [],
      assignedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get all locations
export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("locations").collect();
  },
});

// Alias for getLocations (for backward compatibility)
export const listLocations = getLocations;

// Get recent logs for admin dashboard
export const getRecentLogsForAdmin = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("resident_logs")
      .order("desc")
      .take(args.limit);
  },
});

// Sync locations from string array (for backward compatibility)
export const syncLocationsFromStrings = mutation({
  args: {
    locationNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    // Get existing locations
    const existingLocations = await ctx.db.query("locations").collect();
    const existingNames = new Set(existingLocations.map((l) => l.name));

    // Create new locations that don't exist
    for (const name of args.locationNames) {
      if (!existingNames.has(name)) {
        await ctx.db.insert("locations", {
          name,
          status: "active",
          createdBy: userId,
          createdAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// Create a new location
export const createLocation = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const locationId = await ctx.db.insert("locations", {
      name: args.name,
      address: args.address,
      capacity: args.capacity,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });

    return locationId;
  },
});

// Update a location
export const updateLocation = mutation({
  args: {
    locationId: v.id("locations"),
    name: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.locationId, {
      name: args.name,
      address: args.address,
      capacity: args.capacity,
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete a location
export const deleteLocation = mutation({
  args: {
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!userRole || userRole.role !== "admin") {
      throw new Error("Unauthorized");
    }

    // Check if location is in use
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const residentsInLocation = await ctx.db
      .query("residents")
      .withIndex("by_location", (q) => q.eq("location", location.name))
      .first();

    if (residentsInLocation) {
      throw new Error("Cannot delete location with residents");
    }

    await ctx.db.delete(args.locationId);
    return { success: true };
  },
});

// TEMPORARY: Force create admin for current user (remove after use)
export const forceCreateAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingRole) {
      await ctx.db.patch(existingRole._id, {
        role: "admin",
        locations: [],
        assignedAt: Date.now(),
      });
      return { success: true, message: "Updated to admin" };
    }

    await ctx.db.insert("roles", {
      userId,
      role: "admin",
      locations: [],
      assignedAt: Date.now(),
    });

    return { success: true, message: "Created admin role" };
  },
});