import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  residents: defineTable({
    name: v.string(),
    dateOfBirth: v.optional(v.string()), // Make optional for existing data
    dob: v.optional(v.string()), // Add dob field for compatibility
    location: v.string(),
    guardianIds: v.optional(v.array(v.id("guardians"))),
    medicalInfo: v.optional(v.string()),
    careNotes: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    createdAt: v.optional(v.number()), // Make optional for existing data
    createdBy: v.optional(v.id("users")), // Make optional for existing data
  })
    .index("by_location", ["location"])
    .index("by_createdBy", ["createdBy"]),

  guardians: defineTable({
    name: v.string(),
    relationship: v.optional(v.string()), // Make optional for existing data
    phone: v.string(),
    email: v.string(),
    address: v.optional(v.string()),
    residentIds: v.optional(v.array(v.id("residents"))),
    createdAt: v.optional(v.number()), // Make optional for existing data
    createdBy: v.optional(v.id("users")), // Make optional for existing data
  })
    .index("by_createdBy", ["createdBy"]),

  employees: defineTable({
    id: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()), // Add email field
    workEmail: v.string(),
    phone: v.optional(v.string()), // Add phone field
    role: v.optional(v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff"), v.literal(""))),
    locations: v.array(v.string()),
    invitedAt: v.optional(v.number()),
    invitedBy: v.optional(v.id("users")),
    hasAcceptedInvite: v.boolean(),
    inviteToken: v.optional(v.string()),
    inviteExpiresAt: v.optional(v.number()),
    onboardedBy: v.optional(v.id("users")), // Add onboarded fields
    onboardedAt: v.optional(v.number()),
    inviteBounced: v.optional(v.boolean()),
    inviteResent: v.optional(v.number()),
    employmentStatus: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
  })
    .index("by_workEmail", ["workEmail"])
    .index("by_inviteToken", ["inviteToken"])
    .index("by_email", ["email"]),

  roles: defineTable({
    userId: v.id("users"),
    role: v.optional(v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff"), v.literal(""))),
    locations: v.optional(v.array(v.string())),
    assignedBy: v.optional(v.id("users")),
    assignedAt: v.optional(v.number()),
    teams: v.optional(v.array(v.string())),
  })
    .index("by_userId", ["userId"]),

  shifts: defineTable({
    userId: v.id("users"),
    location: v.string(),
    clockInTime: v.number(),
    clockOutTime: v.optional(v.number()),
    deviceId: v.optional(v.string()),
    kioskId: v.optional(v.id("kiosks")),
    notes: v.optional(v.string()),
    clockInSelfie: v.optional(v.id("_storage")),
    clockOutSelfie: v.optional(v.id("_storage")),
  })
    .index("by_userId", ["userId"])
    .index("by_location", ["location"])
    .index("by_clockInTime", ["clockInTime"]),

  kiosks: defineTable({
    name: v.optional(v.string()), // Make optional for existing data
    location: v.string(),
    deviceId: v.string(),
    deviceLabel: v.optional(v.string()), // Add deviceLabel field
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("maintenance"), v.literal("disabled"), v.literal("retired"))), // Make optional
    active: v.optional(v.boolean()), // Add active field for existing data
    lastHeartbeat: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()), // Add lastSeenAt field
    registeredAt: v.optional(v.number()), // Add registeredAt field
    registeredBy: v.optional(v.id("users")), // Add registeredBy field
    createdAt: v.optional(v.number()), // Make optional for existing data
    createdBy: v.optional(v.id("users")), // Make optional for existing data
  })
    .index("by_location", ["location"])
    .index("by_deviceId", ["deviceId"]),

  resident_logs: defineTable({
    residentId: v.id("residents"),
    logType: v.optional(v.string()),
    content: v.string(),
    timestamp: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    location: v.optional(v.string()), // Make optional for existing data
    shiftId: v.optional(v.id("shifts")),
    authorId: v.optional(v.id("users")),
    version: v.optional(v.number()),
    template: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      mood: v.optional(v.string()),
      behavior: v.optional(v.string()),
      activity: v.optional(v.string()),
      notes: v.optional(v.string()),
    })),
  })
    .index("by_residentId", ["residentId"])
    .index("by_location", ["location"])
    .index("by_authorId", ["authorId"])
    .index("by_createdAt", ["createdAt"]),

  audit_logs: defineTable({
    userId: v.optional(v.id("users")),
    event: v.string(),
    timestamp: v.number(),
    deviceId: v.string(),
    location: v.string(),
    details: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event", ["event"]),

  compliance_alerts: defineTable({
    type: v.union(v.literal("isp"), v.literal("fire_evac")),
    title: v.string(),
    description: v.string(),
    location: v.string(),
    status: v.string(),
    severity: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    dismissedBy: v.optional(v.id("users")),
    dismissedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      residentId: v.optional(v.id("residents")),
      shiftId: v.optional(v.id("shifts")),
      logType: v.optional(v.string()),
      expectedCount: v.optional(v.number()),
      actualCount: v.optional(v.number()),
    })),
  })
    .index("by_status", ["status"])
    .index("by_severity", ["severity"])
    .index("by_location", ["location"])
    .index("by_createdAt", ["createdAt"]),

  // ISP (Individual Service Plan) tables - HIPAA compliant
  isp_files: defineTable({
    residentId: v.id("residents"),
    versionLabel: v.string(), // e.g., "2024-Q1", "Annual Review 2024"
    effectiveDate: v.number(), // When this ISP becomes effective
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    fileStorageId: v.id("_storage"), // Reference to the actual PDF/DOCX file
    fileName: v.string(), // Original filename (sanitized, no PHI)
    fileSize: v.number(),
    contentType: v.string(),
    preparedBy: v.optional(v.string()), // Name of person who prepared (not PHI)
    notes: v.optional(v.string()), // Administrative notes (NO PHI allowed)
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
    activatedBy: v.optional(v.id("users")),
    activatedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    archivedAt: v.optional(v.number()),
  })
    .index("by_residentId", ["residentId"])
    .index("by_status", ["status"])
    .index("by_effectiveDate", ["effectiveDate"])
    .index("by_residentId_versionLabel", ["residentId", "versionLabel"]),

  // ISP access logs for audit trail
  isp_access_logs: defineTable({
    ispFileId: v.id("isp_files"),
    residentId: v.id("residents"), // For easier querying
    userId: v.id("users"),
    action: v.union(
      v.literal("upload"),
      v.literal("download"),
      v.literal("view_list"),
      v.literal("activate"),
      v.literal("archive"),
      v.literal("delete")
    ),
    timestamp: v.number(),
    location: v.string(),
    deviceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_ispFileId", ["ispFileId"])
    .index("by_residentId", ["residentId"])
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),

  // ISP table
  isp: defineTable({
    residentId: v.id("residents"),
    published: v.optional(v.boolean()),
    content: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    version: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
  })
    .index("by_residentId", ["residentId"]),

  // ISP acknowledgments table
  isp_acknowledgments: defineTable({
    residentId: v.id("residents"),
    userId: v.id("users"),
    ispId: v.id("isp"),
    acknowledgedAt: v.number(),
    acknowledgedIsp: v.id("isp"),
  })
    .index("by_resident_and_user", ["residentId", "userId"]),

  // Fire evacuation table - resident-specific evacuation plans
  fire_evac: defineTable({
    residentId: v.id("residents"),
    location: v.optional(v.string()), // Keep for backward compatibility
    version: v.number(),
    mobilityNeeds: v.optional(v.string()), // e.g., "Wheelchair", "Walker", "Ambulatory"
    assistanceRequired: v.optional(v.string()), // e.g., "Two-person assist", "One-person assist"
    medicalEquipment: v.optional(v.string()), // e.g., "Oxygen tank", "CPAP machine"
    specialInstructions: v.optional(v.string()), // Any special evacuation instructions
    createdAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_residentId", ["residentId"])
    .index("by_location", ["location"]),

  // Config table
  config: defineTable({
    complianceReminderTemplate: v.optional(v.string()),
    guardianInviteTemplate: v.optional(v.string()),
    alertWeekday: v.optional(v.number()),
    alertHour: v.optional(v.number()),
    alertMinute: v.optional(v.number()),
    selfieEnforced: v.optional(v.boolean()),
  }),

  // Guardian checklist templates
  guardian_checklist_templates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    questions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      type: v.union(v.literal("yes_no"), v.literal("text"), v.literal("rating")),
      required: v.boolean(),
    })),
    createdBy: v.id("users"),
    createdAt: v.number(),
    active: v.boolean(),
  })
    .index("by_active", ["active"]),

  // Guardian checklist links
  guardian_checklist_links: defineTable({
    residentId: v.id("residents"),
    templateId: v.id("guardian_checklist_templates"),
    guardianEmail: v.string(),
    token: v.string(),
    sentDate: v.number(),
    expiresAt: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    responses: v.optional(v.array(v.object({
      questionId: v.string(),
      answer: v.union(v.string(), v.number(), v.boolean()),
    }))),
  })
    .index("by_token", ["token"])
    .index("by_residentId", ["residentId"]),

  // Kiosk pairing tokens
  kiosk_pairing_tokens: defineTable({
    token: v.string(),
    deviceId: v.string(),
    location: v.string(),
    deviceLabel: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("used"), v.literal("expired")),
    issuedBy: v.id("users"),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  // Locations table
  locations: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_name", ["name"]),

  // Compliance reminder templates
  compliance_reminder_templates: defineTable({
    name: v.string(),
    type: v.union(v.literal("isp"), v.literal("fire_evac"), v.literal("general")),
    subject: v.string(),
    body: v.string(),
    daysBeforeDue: v.number(), // Send reminder X days before due date
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_active", ["active"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
