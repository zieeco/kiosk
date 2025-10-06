import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper: Get user role and permissions
async function getUserRoleDoc(ctx: any, userId: Id<"users">) {
  return await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

// Helper: Audit access attempts (for mutations only)
async function auditAccess(ctx: any, userId: Id<"users"> | null, route: string, granted: boolean, reason?: string) {
  await ctx.db.insert("audit_logs", {
    userId: userId ?? undefined,
    event: granted ? "access_granted" : "access_denied",
    timestamp: Date.now(),
    deviceId: "web",
    location: "system",
    details: `route=${route},granted=${granted},reason=${reason || "none"}`,
  });
}

// Query: Check user access permissions for a route
export const checkAccess = query({
  args: { 
    route: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return {
        granted: false,
        reason: "not_authenticated",
        redirectTo: "/signin",
        userRole: null,
        locations: [],
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        granted: false,
        reason: "user_not_found", 
        redirectTo: "/signin",
        userRole: null,
        locations: [],
      };
    }

    const roleDoc = await getUserRoleDoc(ctx, userId);
    
    if (!roleDoc) {
      return {
        granted: false,
        reason: "no_role_assigned",
        redirectTo: "/pending",
        userRole: null,
        locations: [],
      };
    }

    const { role, locations } = roleDoc;

    // Route access rules
    const adminRoutes = ["/admin", "/settings", "/people/employees"];
    const careRoutes = ["/care", "/residents", "/guardians"];
    const publicRoutes = ["/", "/signin", "/pending"];

    let granted = false;
    let reason = "";
    let redirectTo = "";

    // Check if route is public
    if (publicRoutes.some(route => args.route.startsWith(route))) {
      granted = true;
      reason = "public_route";
    }
    // Admin access
    else if (adminRoutes.some(route => args.route.startsWith(route))) {
      if (role === "admin") {
        granted = true;
        reason = "admin_access";
      } else {
        granted = false;
        reason = "insufficient_privileges";
        redirectTo = role === "supervisor" || role === "staff" ? "/care" : "/pending";
      }
    }
    // Care portal access
    else if (careRoutes.some(route => args.route.startsWith(route))) {
      if (role === "supervisor" || role === "staff") {
        granted = true;
        reason = "care_access";
      } else if (role === "admin") {
        granted = true;
        reason = "admin_override";
      } else {
        granted = false;
        reason = "insufficient_privileges";
        redirectTo = "/pending";
      }
    }
    // Default deny
    else {
      granted = false;
      reason = "route_not_found";
      redirectTo = role === "admin" ? "/admin" : 
                  (role === "supervisor" || role === "staff") ? "/care" : "/pending";
    }

    return {
      granted,
      reason,
      redirectTo,
      userRole: role,
      locations: locations || [],
      userId,
      userName: user.name || user.email || "Unknown",
    };
  },
});

// Query: Get user session info
export const getSessionInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return {
        authenticated: false,
        user: null,
        role: null,
        locations: [],
        defaultRoute: "/signin",
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        authenticated: false,
        user: null,
        role: null,
        locations: [],
        defaultRoute: "/signin",
      };
    }

    const roleDoc = await getUserRoleDoc(ctx, userId);
    
    if (!roleDoc) {
      return {
        authenticated: true,
        user: {
          id: user._id,
          name: user.name || user.email || "Unknown",
          email: user.email,
        },
        role: null,
        locations: [],
        defaultRoute: "/pending",
      };
    }

    const { role, locations } = roleDoc;
    
    // Determine default route based on role
    let defaultRoute = "/pending";
    if (role === "admin") {
      defaultRoute = "/admin";
    } else if (role === "supervisor" || role === "staff") {
      defaultRoute = "/care";
    }

    return {
      authenticated: true,
      user: {
        id: user._id,
        name: user.name || user.email || "Unknown",
        email: user.email,
      },
      role,
      locations: locations || [],
      defaultRoute,
    };
  },
});

// Mutation: Log session activity
export const logSessionActivity = mutation({
  args: {
    activity: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    await ctx.db.insert("audit_logs", {
      userId,
      event: args.activity,
      timestamp: Date.now(),
      deviceId: "web",
      location: "system",
      details: args.details,
    });
  },
});
