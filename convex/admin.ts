import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper: Get user role doc
async function getUserRoleDoc(ctx: any, userId: Id<"users">) {
  return await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

// Helper: Check if user has admin access
async function requireAdminAccess(ctx: any, userId: Id<"users">) {
  const userRole = await getUserRoleDoc(ctx, userId);
  if (!userRole || userRole.role !== "admin") {
    throw new Error("Admin access required");
  }
  return userRole;
}

// Query: Get recent logs for admin dashboard (admin only)
export const getRecentLogsForAdmin = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    await requireAdminAccess(ctx, userId);
    
    // Get recent logs from all staff and supervisors
    const recentLogs = await ctx.db
      .query("resident_logs")
      .order("desc")
      .take(args.limit || 20);
    
    // Get additional data for each log
    const users = await ctx.db.query("users").collect();
    const residents = await ctx.db.query("residents").collect();
    const roles = await ctx.db.query("roles").collect();
    
    const enrichedLogs = await Promise.all(
      recentLogs.map(async (log) => {
        const author = users.find(u => u._id === log.authorId);
        const resident = residents.find(r => r._id === log.residentId);
        const authorRole = roles.find(r => r.userId === log.authorId);
        
        return {
          id: log._id,
          residentId: log.residentId,
          residentName: resident?.name || "Unknown Resident",
          residentLocation: resident?.location || "Unknown Location",
          authorId: log.authorId,
          authorName: author?.name || author?.email || "Unknown User",
          authorRole: authorRole?.role || "unknown",
          version: log.version,
          template: log.template,
          content: log.content,
          createdAt: log.createdAt || Date.now(),
        };
      })
    );
    
    return enrichedLogs;
  },
});

// Migration: Sync existing location strings to locations table
export const syncLocationsFromStrings = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    const locationStrings = new Set<string>();
    
    // Collect locations from residents
    const residents = await ctx.db.query("residents").collect();
    residents.forEach(r => {
      if (r.location) locationStrings.add(r.location);
    });
    
    // Collect locations from employees
    const employees = await ctx.db.query("employees").collect();
    employees.forEach(e => {
      if (e.locations) {
        e.locations.forEach(loc => locationStrings.add(loc));
      }
    });
    
    // Collect locations from shifts
    const shifts = await ctx.db.query("shifts").collect();
    shifts.forEach(s => {
      if (s.location) locationStrings.add(s.location);
    });
    
    // Collect locations from kiosks
    const kiosks = await ctx.db.query("kiosks").collect();
    kiosks.forEach(k => {
      if (k.location) locationStrings.add(k.location);
    });
    
    // Check which locations already exist
    const existingLocations = await ctx.db.query("locations").collect();
    const existingNames = new Set(existingLocations.map(l => l.name));
    
    // Create location records for any that don't exist
    const created = [];
    for (const locationName of locationStrings) {
      if (!existingNames.has(locationName)) {
        const id = await ctx.db.insert("locations", {
          name: locationName,
          status: "active" as const,
          createdBy: userId,
          createdAt: Date.now(),
        });
        created.push({ id, name: locationName });
      }
    }
    
    return {
      success: true,
      totalFound: locationStrings.size,
      alreadyExisted: existingLocations.length,
      created: created.length,
      locations: created,
    };
  },
});

// Location Management
export const listLocations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    const locations = await ctx.db.query("locations").collect();
    return locations.map(loc => ({
      _id: loc._id,
      name: loc.name,
      address: loc.address,
      capacity: loc.capacity,
      status: loc.status,
      createdBy: loc.createdBy,
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
    }));
  },
});

export const createLocation = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    return await ctx.db.insert("locations", {
      name: args.name,
      address: args.address,
      capacity: args.capacity,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

export const updateLocation = mutation({
  args: {
    locationId: v.id("locations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.address !== undefined) updates.address = args.address;
    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.status !== undefined) updates.status = args.status;
    
    await ctx.db.patch(args.locationId, updates);
    return { success: true };
  },
});

// Delete location (admin only) - WITH VALIDATION
export const deleteLocation = mutation({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");
    
    // Check if location is in use
    const residents = await ctx.db
      .query("residents")
      .withIndex("by_location", (q) => q.eq("location", location.name))
      .first();
    
    if (residents) {
      throw new Error("Cannot delete location: It is assigned to one or more residents. Please reassign residents first.");
    }
    
    const kiosks = await ctx.db
      .query("kiosks")
      .withIndex("by_location", (q) => q.eq("location", location.name))
      .first();
    
    if (kiosks) {
      throw new Error("Cannot delete location: It has registered kiosks. Please remove or reassign kiosks first.");
    }
    
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_location", (q) => q.eq("location", location.name))
      .first();
    
    if (shifts) {
      throw new Error("Cannot delete location: It has shift records. Please archive this location instead of deleting it.");
    }
    
    // Check employees
    const employees = await ctx.db.query("employees").collect();
    const employeeWithLocation = employees.find(e => e.locations?.includes(location.name));
    
    if (employeeWithLocation) {
      throw new Error("Cannot delete location: It is assigned to one or more employees. Please update employee assignments first.");
    }
    
    // If no dependencies, delete the location
    await ctx.db.delete(args.locationId);
    
    return { success: true };
  },
});
