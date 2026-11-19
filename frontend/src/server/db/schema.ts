/**
 * Database tables (Postgres). Phase 1: people, sign-in and class history.
 * Later phases add content, quizzes and marks — see docs/platform-build-plan.md §4.
 *
 * After changing this file run `npm run db:generate` to write a migration.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, serial, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ROLES = ["admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];
export const USER_STATUSES = ["active", "archived"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const MEDIUMS = ["en", "ta"] as const;
export type Medium = (typeof MEDIUMS)[number];
export const CHANGE_REASONS = ["created", "auto", "admin", "graduated", "restored"] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role", { enum: ROLES }).notNull(),
    /** Lower-case, unique. Students sign in with this. */
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", { enum: USER_STATUSES }).notNull().default("active"),
    /** Wrong passwords in a row; reset on a good sign-in. */
    failedLogins: smallint("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    check("users_username_format", sql`${t.username} ~ '^[a-z0-9._-]{3,32}$'`),
    index("users_role_status_idx").on(t.role, t.status),
  ],
);

export const students = pgTable(
  "students",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Class 4–12. */
    standard: smallint("standard").notNull(),
    /** Medium of instruction: which video and textbook language to show first. */
    medium: text("medium", { enum: MEDIUMS }).notNull().default("en"),
    /** Higher-secondary stream (Class 11–12), e.g. "cs". Null below Class 11 or until chosen. */
    groupId: text("group_id"),
    section: text("section"),
    /** The academic year (start year, e.g. 2026 for 2026–27) this class is for. */
    promotedForYear: smallint("promoted_for_year").notNull(),
    admissionYear: smallint("admission_year").notNull(),
  },
  (t) => [
    check("students_standard_range", sql`${t.standard} between 4 and 12`),
    index("students_standard_idx").on(t.standard),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token, so a leaked table can't be used to sign in. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Every class change: on creation, yearly promotion, by an admin, on finishing Class 12. */
export const classChanges = pgTable(
  "class_changes",
  {
    id: serial("id").primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromStandard: smallint("from_standard"),
    toStandard: smallint("to_standard"),
    fromGroup: text("from_group"),
    toGroup: text("to_group"),
    reason: text("reason", { enum: CHANGE_REASONS }).notNull(),
    academicYear: smallint("academic_year").notNull(),
    byUserId: uuid("by_user_id").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("class_changes_student_idx").on(t.studentId)],
);

/** Small key/value settings, e.g. the promotion date. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Runs of the yearly promotion, so the same year is never applied twice by mistake. */
export const promotionRuns = pgTable("promotion_runs", {
  id: serial("id").primaryKey(),
  academicYear: smallint("academic_year").notNull(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  promoted: integer("promoted").notNull(),
  graduated: integer("graduated").notNull(),
  byUserId: uuid("by_user_id").references(() => users.id, { onDelete: "set null" }),
});
