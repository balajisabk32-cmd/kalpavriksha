# Kalpavriksha — Backend plan

Status: draft · 2026-11-15
Feature plan (what we build and why): [`learning-portal-plan.md`](learning-portal-plan.md). Its analogy tables (`concepts`, `analogies`) extend §4 below.

## 1. Where things stand today

The app is a Next.js 16 frontend. Everything a student does is saved in the browser (`localStorage`, key `kalpavriksha.progress`). The "backend" is two route handlers:

| Piece | File | What it does | Problem |
| --- | --- | --- | --- |
| Curriculum API | `frontend/src/app/api/curriculum/route.ts` | `GET ?standard=N` returns subjects + chapters from `lib/curriculum.ts` | Works. Nothing in the UI calls it — every screen imports the 30,000-line `curriculum.ts` straight into the browser bundle. |
| Profile API | `frontend/src/app/api/profile/route.ts` | `GET/POST/PATCH` one profile, kept in memory and in `.profile-store.json` | **One global profile for every user.** `authService.syncWithServer()` (called by `module-shell.tsx`) copies it into any device with no local profile, so a new device shows the last student's name. |
| Auth service | `frontend/src/lib/auth-service.ts` | Saves the profile locally, fire-and-forget POST/PATCH to `/api/profile` | `signOut()` POSTs `{name:"", grade:0}`, which the route rejects with 400, so the server copy is never cleared. |
| Progress | `lib/progress.ts` (pure), `components/progress-store.ts` (store) | XP, lessons done, songs heard, best quiz %, growth activities, active days, last-opened chapter | Never leaves the device. Lost when the browser is cleared; can't be seen by a teacher; XP is computed on the client and can be edited. |

| Textbooks | `lib/curriculum.ts` | 696 chapters, each with a `pdf` resource | All 695 PDF entries point to 7 outside portal links (tntextbooks.net, share.google). No textbook text or page numbers are stored. |
| Video lessons | `modules/learn/interactive-chapter-classroom.tsx:464`, `:2553` | A "Interactive Video Explanation" card is generated for every chapter | **Fake.** No chapter has a video. The card shows a made-up "14:20 mins" and "verified", and the player is a placeholder saying "Streaming ready on all student devices". |

What is **not** there: a database, real sign-in, sessions, roles (teacher / volunteer / admin), progress sync, any teacher view, real video lessons, and a deploy target.

What can be reused: 684 of 696 chapters already have `practiceQuestions`, which can become video checkpoint quizzes.

The good news: `lib/progress.ts` is already pure and well-tested (`progress.test.ts`), with defensive parsers (`parseProgress`, `parseProfile`). The same functions can run on the server to validate and recompute progress, so the client and server agree by construction.

## 2. Goals

1. A student's progress survives a cleared browser and follows them to another device.
2. Volunteers/teachers at a centre can see how their students are doing.
3. Works on cheap shared devices with patchy internet: the app keeps working offline and syncs later.
4. Collects as little personal data as possible — these are children (see §8).
5. Cheap and simple to run for a trust: one deploy, managed database, no servers to babysit.
6. **Every chapter gets a video explanation** that pauses for quick questions and points to the matching textbook page (see §6a). This is the main learning feature.

## 3. Recommended architecture

**Keep the backend inside the Next.js app** (route handlers under `src/app/api/` plus a `src/server/` folder), not a separate `backend/` service. One codebase, one deploy, shared TypeScript types, and `lib/progress.ts` reused as-is on the server. Split out later only if a mobile app or another client needs it.

| Concern | Choice | Why |
| --- | --- | --- |
| Database | PostgreSQL (managed: Neon or Supabase free tier) | Relational data (centre → class → student → events), free tier fits, easy backups |
| ORM / migrations | Drizzle ORM + drizzle-kit | Type-safe, light, SQL-first migrations checked into git |
| Validation | Zod schemas in `src/server/schemas.ts` | Same schema validates requests and types the client |
| Sessions | Opaque session token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; sessions table in Postgres | No JWT revocation problems; simple to sign out a lost device |
| Student sign-in | Centre code + student code + 4-digit PIN (or picture PIN for Seedlings) | Kids have no email; teacher creates the account and can reset the PIN |
| Staff sign-in | Email magic link (or Google) for teachers/volunteers/admins | No passwords to manage |
| Hosting | Vercel (or any Node host) + managed Postgres | Matches Next.js; zero ops |
| Rate limiting | Per-IP + per-account counter on PIN login (table or Upstash) | 4-digit PINs must be throttled |

Folder layout to add:

```
frontend/src/
├── server/
│   ├── db/schema.ts        Drizzle tables
│   ├── db/index.ts         Connection
│   ├── auth.ts             Sessions, getCurrentStudent/Staff, requireRole
│   ├── schemas.ts          Zod request/response schemas
│   └── progress-sync.ts    Applies events with lib/progress.ts reducers
├── app/api/
│   ├── auth/student/route.ts   POST sign in
│   ├── auth/staff/route.ts     POST magic-link request, GET callback
│   ├── auth/logout/route.ts
│   ├── me/route.ts             GET / PATCH own profile
│   ├── progress/route.ts       GET snapshot
│   ├── progress/events/route.ts POST batch of events
│   ├── curriculum/…            (exists) + per-chapter route
│   └── staff/…                 Teacher endpoints (§5)
└── drizzle/                migrations
```

## 4. Data model

```
centres        id, code (unique, e.g. "KV-CHN-01"), name, created_at
staff          id, email (unique), name, role (teacher|admin), created_at
staff_centres  staff_id, centre_id                      -- which centres a teacher sees
students       id, centre_id, student_code (unique per centre), display_name (first name only),
               avatar, grade, board, senior_group, preferred_language,
               pin_hash, pin_failed_count, pin_locked_until,
               created_by_staff_id, created_at, deleted_at
sessions       id (random 32 bytes, stored hashed), subject_type (student|staff), subject_id,
               created_at, expires_at, last_seen_at, user_agent
progress_events id, student_id, client_event_id (uuid, unique per student),
               type (lesson_done|song_heard|quiz_result|activity_logged|activity_removed|chapter_opened),
               payload jsonb, occurred_at (client time), received_at
progress_snapshots student_id (pk), progress jsonb (the Progress shape), xp, updated_at

-- Video lessons (§6a)
textbooks      id, standard, subject_id, term, language, title, pdf_url, source (e.g. "TNSCERT"), edition_year
video_lessons  id, chapter_id, provider (youtube|bunny), provider_video_id, title, language,
               duration_sec, source_channel, status (draft|published|broken),
               last_checked_at, created_by_staff_id, published_at
video_checkpoints id, video_lesson_id, trigger_sec, gate (hard|soft), rewind_sec,
               question jsonb (LocalizedText stem, options, answer_index, hint),
               practice_question_id (nullable: reuse from curriculum), analogy jsonb (nullable),
               textbook_id, textbook_page, sort_order
video_views    id, student_id, video_lesson_id, watched_sec, completed_at, checkpoint_results jsonb
```

- One chapter can have more than one video (for example, a Tamil and an English one); the student's `preferredLanguage` picks which plays first.
- `video_views` can be written through the same `progress_events` pipeline (new event types `video_checkpoint` and `video_completed`), so XP for videos is computed on the server like everything else.

- `progress_events` is append-only and is the source of truth. `client_event_id` makes uploads idempotent: re-sending a batch after a dropped connection is harmless.
- `progress_snapshots` is recomputed on the server by folding events through `completeLesson`, `completeSong`, `recordQuiz`, `logActivity`, `removeActivity`, `setLastAccessed` from `lib/progress.ts`. The server never trusts a client-sent XP number.
- `studentId` in `lib/progress.ts` (`KV-TN-6-2026`) is not unique (every class-6 TN student in 2026 gets the same one). Keep it as a display label only; use the database `id` + `student_code` for identity.

## 5. API surface

Student (session cookie, role = student):

| Method | Path | Body / result |
| --- | --- | --- |
| POST | `/api/auth/student` | `{centreCode, studentCode, pin}` → sets cookie, returns profile + snapshot |
| POST | `/api/auth/logout` | clears session |
| GET | `/api/me` | profile |
| PATCH | `/api/me` | `{grade?, seniorGroup?, board?, preferredLanguage?, avatar?}` — keeps the existing class 11/12 group rule |
| GET | `/api/progress` | `Progress` snapshot |
| POST | `/api/progress/events` | `{events: [...]}` up to 200 → `{accepted, duplicates, snapshot}` |

Staff (role = teacher/admin, scoped to their centres):

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/staff/students` | list / create students in a centre (returns the one-time PIN) |
| PATCH/DELETE | `/api/staff/students/:id` | edit, reset PIN, soft-delete |
| GET | `/api/staff/centres/:id/progress` | per-student XP, lessons, quiz best, streak, growth areas |
| GET | `/api/staff/centres/:id/export.csv` | export for reports |

Content (public, cacheable):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/curriculum?standard=N` | exists |
| GET | `/api/curriculum/:standard/:subjectId/:chapterId` | new — lets the reader load one chapter instead of the whole file |
| GET | `/api/lessons/:chapterId/video` | the chapter's published video manifest: video id, checkpoints, textbook page refs (one request per chapter, cacheable) |

Video authoring (staff):

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/staff/videos` | list by class/subject/status; attach a YouTube URL to a chapter |
| PATCH/DELETE | `/api/staff/videos/:id` | edit, publish, unpublish |
| PUT | `/api/staff/videos/:id/checkpoints` | replace the checkpoint list (times, questions, rewind, textbook page) |
| GET | `/api/staff/videos/coverage` | which chapters still have no published video |

Before writing any route code, read the route-handler and cookies guides in `frontend/node_modules/next/dist/docs/`. This Next.js version has breaking API changes (see `frontend/AGENTS.md`).

## 6. Offline-first sync (client changes)

1. Keep `progress-store.ts` and `localStorage` as the local cache — the UI stays instant and offline-capable.
2. Every `updateProgress(...)` call site (quiz, songs, grow screen, learn screens) also appends a typed event to an outbox in `localStorage` (`kalpavriksha.outbox`). Wrap this in one helper, e.g. `recordEvent(type, payload)`, so call sites change from `updateProgress((p) => completeLesson(...))` to `recordEvent("lesson_done", {lessonId})`, which does both.
3. A sync loop flushes the outbox on load, on `online`, and every ~60 s while signed in; on success it replaces local progress with the server snapshot.
4. First sign-in on a device that already has local progress: upload the existing progress as one `import` batch so nothing earned before accounts existed is lost.
5. Signed-out / mock mode keeps today's behaviour exactly (`NEXT_PUBLIC_AUTH_PROVIDER=mock_local`).

## 6a. Video lessons

Based on the "Interactive Video & Textbook Learning Portal" blueprint (`docs/Interactive Learning Portal Architecture & Blueprint.html.pdf`), cut down to what a trust can build and keep running.

**How it works for the student**
1. The chapter page loads the video manifest once (`GET /api/lessons/:chapterId/video`).
2. A YouTube IFrame player plays the video. A timer (every ~250 ms) compares `getCurrentTime()` with the checkpoint times.
3. At a checkpoint the video pauses and a question appears. Right answer → continue. Wrong answer → show the hint and the textbook page, rewind `rewind_sec` (default 30 s). A **hard** gate must be answered before continuing; a **soft** gate can be skipped.
4. A side panel shows "Textbook: Class 10 Maths, page 84" with a link to the PDF.
5. If there is no video, or the connection is too weak, the chapter falls back to the existing text lesson plus read-aloud. A chapter never shows an empty or fake player.

**How it works for a teacher/volunteer** (on the `/staff` pages)
1. Pick class → subject → chapter, paste a YouTube URL.
2. Watch it in the editor; press "Add checkpoint here" at the current time; choose one of the chapter's existing practice questions or write a new one; set the textbook page.
3. Publish. Expect roughly 15–20 minutes per video.

**Where the videos come from**
1. First: curate existing YouTube lessons in Tamil and English aligned with the Samacheer Kalvi syllabus (for example the Tamil Nadu government's Kalvi TV channel — confirm coverage and that embedding is allowed).
2. To fill gaps: volunteers record their own, hosted as unlisted YouTube videos or on Bunny Stream (gives control and offline download later).
3. A weekly job checks every published video still exists and is embeddable, and marks broken ones `broken` so they fall back to the text lesson and appear on the coverage list.

**Taken from the blueprint now:** timed pause-and-quiz, rewind on wrong answer, hard/soft gates, textbook page references, hand-authored checkpoints ("Mode B"), analogy card as an optional field.

**Deferred or dropped, and why**
| Blueprint item | Decision | Reason |
| --- | --- | --- |
| Automatic subtitle-to-textbook matching (Sentence-BERT, "Mode A") | Dropped for now | YouTube auto-subtitles for Tamil are poor; hand-set checkpoints are more reliable and only take ~15 min |
| Redis manifest cache, hashed answers, "<5 ms" target | Dropped | One cacheable API call per chapter is enough; hashing a 3-option answer protects nothing |
| Textbook that scrolls in step with the video sentence by sentence | Later | Needs textbook text stored in the app and sentence-level timing |
| Persona analogy switcher ("Metaphor Radio") | Later | Four versions of every analogy is a lot of writing |
| AI rubric grading, spoken-answer "Feynman mode", Socratic tutor, concept-map | Phase 6+ | Needs paid AI APIs, and voice recording of children needs consent (§8) |

**Effort.** Building the player, manifest API and authoring form is about 1–2 weeks. Curating 696 chapters at ~20 min each is about 230 volunteer hours, so roll out one class and subject at a time (suggested start: Class 10 Maths or Science), test with students, then expand.

## 7. Phases

**Phase 0 — fix the mock (½ day, no DB)**
- Stop `syncWithServer()` seeding another user's profile; scope the mock profile per device or remove the server copy in mock mode.
- Fix `signOut()` (add a `DELETE /api/profile` instead of the invalid POST).
- Remove the fake video card and placeholder player in `interactive-chapter-classroom.tsx` (made-up duration, "verified" badge, "Streaming ready" text) until real videos exist.
- Update the README line "Frontend only" once the backend lands.

**Phase 1 — foundation (2–3 days)**
- Add Drizzle, Zod, Postgres; schema + first migration; `.env.example` with `DATABASE_URL`, `SESSION_SECRET`.
- `src/server/auth.ts`: session create/verify/revoke, `requireStudent`, `requireStaff(role)`.
- Student PIN sign-in with lockout (5 failures → 15 min), `/api/me`, logout.
- Seed script: one centre, one admin, a few test students.
- Replace `/api/profile` with `/api/me`; point `auth-service.ts` at it.

**Phase 2 — progress sync (2–3 days)**
- `progress_events` + `progress_snapshots`, `POST /api/progress/events`, `GET /api/progress`.
- Client outbox + sync loop + first-sign-in import.
- Server-side caps: one `quiz_result` can't exceed its question count; ignore events dated in the future; per-student daily event limit.

**Phase 3 — staff tools (3–4 days)**
- Magic-link sign-in for staff; staff endpoints from §5.
- A simple `/staff` area: student list, create student + print PIN card, class progress table, CSV export.

**Phase 3b — video lessons (1–2 weeks of build, then ongoing curation)**
- Tables from §4 (`textbooks`, `video_lessons`, `video_checkpoints`), manifest API, staff video endpoints.
- Student player: YouTube IFrame API, checkpoint timer, question overlay, rewind, textbook page panel, text/read-aloud fallback.
- Staff editor: attach URL, add checkpoints at the current time, reuse practice questions, publish; coverage list.
- Weekly broken-video check.
- Pilot with one class and subject, then expand.

**Phase 4 — content and performance (2 days)**
- Move curriculum reads to the API / server components so the 30k-line `curriculum.ts` stops shipping to every browser.
- Later: move lessons, quiz questions and songs into the database with an admin editor, if non-developers need to edit content.

**Phase 5 — hardening**
- Tests: route-handler tests like `profile.test.ts`, against a throwaway Postgres (Docker or Neon branch).
- Error logging, daily DB backups, privacy page, data-deletion endpoint for staff.

## 8. Privacy and safety (children's data)

- India's DPDP Act 2023 treats everyone under 18 as a child: verifiable parental consent is required before processing their data, and tracking/behavioural monitoring of children is restricted. Collect consent at enrolment (paper form at the centre is fine; record `consent_recorded_at` and who recorded it).
- Store first name only, no student email, no phone, no photos. The current profile `email` field should be dropped for students.
- PINs hashed (argon2id or bcrypt), never shown again after creation.
- Staff see only their own centres. Soft-delete with a hard-delete job after a retention period.
- No third-party analytics on student pages.

## 9. Open decisions

1. **Who creates student accounts?** Plan assumes teachers/volunteers at a centre. If students must self-register, sign-in needs a different design.
2. **Hosting and budget** — Vercel + Neon free tiers assumed.
3. **Shared devices** — if several children use one tablet, add a "pick your avatar" quick switcher with per-student PINs.
4. **Content editing** — do non-developers need to edit lessons/songs soon (pulls Phase 4 forward)?
5. **Video source** — curate existing YouTube channels first, or record our own? And which class/subject pilots first?
6. **Textbook files** — keep linking to the outside portals, or host the official PDFs ourselves (check the licence) so page links open at the right page?
