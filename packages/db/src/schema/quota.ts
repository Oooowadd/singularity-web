import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users, type BonusBalances } from "./users";

// period = 'YYYY-MM' (Asia/Shanghai) — monthly action counters for quota checks.
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    contentsUsed: integer("contents_used").notNull().default(0),
    generationsUsed: integer("generations_used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.period] }),
  }),
);

export const redemptionCodes = pgTable("redemption_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  grant: jsonb("grant").$type<BonusBalances>().notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const codeRedemptions = pgTable(
  "code_redemptions",
  {
    codeId: uuid("code_id")
      .notNull()
      .references(() => redemptionCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.codeId, table.userId] }),
  }),
);

// Audit trail for every bonus change (code redemption or manual admin action).
export const quotaAdjustments = pgTable("quota_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["code", "admin"] }).notNull(),
  codeId: uuid("code_id"),
  accountsDelta: integer("accounts_delta").notNull().default(0),
  contentsDelta: integer("contents_delta").notNull().default(0),
  generationsDelta: integer("generations_delta").notNull().default(0),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RedemptionCode = typeof redemptionCodes.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
