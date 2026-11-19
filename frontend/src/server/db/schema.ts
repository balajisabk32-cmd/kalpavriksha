/**
 * Database tables (Postgres). Phase 1: people, sign-in and class history.
 * Later phases add content, quizzes and marks — see docs/platform-build-plan.md §4.
 *
 * After changing this file run `npm run db:generate` to write a migration.
 */
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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

// ---------------------------------------------------------------------------
// Content (Phase 2): videos by textbook unit, textbooks and chapter page ranges.
// ---------------------------------------------------------------------------

export const UNIT_MATCHES = ["title", "number", "order", "manual", "subject"] as const;
export type UnitMatch = (typeof UNIT_MATCHES)[number];

/**
 * A unit of the textbook as the content team lists it (Term 1 · Unit 2 · "Matter and Materials").
 * `chapterId` links it to an app chapter (curriculum-data.ts); `match` says how that link was made.
 * `unitNo` null = videos for the whole subject (e.g. one playlist for every chapter).
 */
export const contentUnits = pgTable(
  "content_units",
  {
    id: serial("id").primaryKey(),
    standard: smallint("standard").notNull(),
    subjectId: text("subject_id").notNull(),
    medium: text("medium", { enum: MEDIUMS }).notNull(),
    term: smallint("term"),
    unitNo: smallint("unit_no"),
    title: text("title").notNull(),
    chapterId: text("chapter_id"),
    match: text("match", { enum: UNIT_MATCHES }),
    source: text("source"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("content_units_key").on(t.standard, t.subjectId, t.medium, t.term, t.unitNo).nullsNotDistinct(),
    index("content_units_chapter_idx").on(t.chapterId),
  ],
);

export const VIDEO_KINDS = ["lesson", "qa"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

/** One YouTube video or playlist inside a unit, in teaching order. */
export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => contentUnits.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: VIDEO_KINDS }).notNull().default("lesson"),
    title: text("title").notNull(),
    youtubeId: text("youtube_id"),
    playlistId: text("playlist_id"),
    position: smallint("position").notNull(),
    note: text("note"),
  },
  (t) => [
    check("videos_one_source", sql`(${t.youtubeId} is null) <> (${t.playlistId} is null)`),
    index("videos_unit_idx").on(t.unitId),
  ],
);

/** A textbook PDF (one file per book or per term volume). */
export const textbooks = pgTable(
  "textbooks",
  {
    id: serial("id").primaryKey(),
    standard: smallint("standard").notNull(),
    subjectId: text("subject_id").notNull(),
    medium: text("medium", { enum: MEDIUMS }).notNull(),
    term: smallint("term"),
    title: text("title").notNull(),
    /** Key in file storage (local folder now, Cloudflare R2 later). */
    storageKey: text("storage_key").notNull().unique(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    pages: smallint("pages"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("textbooks_subject_idx").on(t.standard, t.subjectId)],
);

/** Which pages of a textbook a chapter covers, so the reader opens at the right page. */
export const chapterPages = pgTable(
  "chapter_pages",
  {
    chapterId: text("chapter_id").notNull(),
    textbookId: integer("textbook_id")
      .notNull()
      .references(() => textbooks.id, { onDelete: "cascade" }),
    startPage: smallint("start_page").notNull(),
    endPage: smallint("end_page").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.chapterId, t.textbookId] }),
    check("chapter_pages_range", sql`${t.startPage} >= 1 and ${t.endPage} >= ${t.startPage}`),
  ],
);

// ---------------------------------------------------------------------------
// Learning progress (Phase 3)
// ---------------------------------------------------------------------------

/** How much of each video a student has watched. */
export const videoViews = pgTable(
  "video_views",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    /** Furthest point reached, in seconds. */
    seconds: integer("seconds").notNull().default(0),
    duration: integer("duration"),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

/**
 * A student's device progress (XP, lessons done, review cards…), the same shape
 * as `Progress` in lib/progress.ts, so it follows them to any device.
 */
export const studentProgress = pgTable("student_progress", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
