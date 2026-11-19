# Kalpavriksha — Platform build plan (Classes 4–12)

Status: draft · 2026-11-19
Replaces the open decisions in [`backend-plan.md`](backend-plan.md) and the roadmap in [`learning-portal-plan.md`](learning-portal-plan.md). Where they disagree, this document wins.

## 1. What we are building

A Tamil–English learning portal for the Kalpavriksha trust, Classes 4–12. Classes 1–3 stay in the code but are hidden.

| Role | Can do |
| --- | --- |
| **Admin** | Create student logins for a class, one at a time or in bulk from a spreadsheet. Create teacher logins. Change a student's class. Reset passwords. Bring archived students back. |
| **Teacher** | See every class and every student. Create pop quizzes and assignments. Mark short answers. See the gradebook. |
| **Student** | Open a subject, then a lesson. Read the explanation (with real-life examples), watch the video, read the textbook alongside it, take pop quizzes and submit assignments. |

- **Moving up a class:** every year on **1 June**, every active student goes up one class. Class 12 students are archived: they can't log in, but their records are kept. The admin can change any student's class at any time.
- **Assignments:** multiple-choice and short answers only, for now. Multiple-choice is marked automatically; a teacher marks short answers.
- **Marks:** pop-quiz scores and assignment marks go into one gradebook per student and per class.
- **Languages:** Tamil and English everywhere. In Tamil mode, no English text is shown except proper nouns and code.

## 2. What your team's spreadsheets contain

| File | Shape | How we import it |
| --- | --- | --- |
| `Class4_TN_Syllabus_resouce.xlsx` (the "(1)" copy is byte-identical) | Two sheets: **English medium** and **Tamil medium**. Each row is Class, Subject, Term, Unit, Chapter Title, YouTube link. Some units are split into "part 1 / part 2", and there are "Q & A" rows (some have a video). The Channel, Duration, Video type and Remarks columns are almost empty. | **Direct.** One video per chapter, or several parts. 241 links in total. |
| `class 9.xlsx` | One row per subject. Each is a **whole playlist** or a **channel search page**. | **Needs mapping.** Playlist → we list its videos with the YouTube API and match them to chapters by title, then a person checks the matches. A channel search page can't be embedded, so someone has to pick a playlist or specific videos. |
| `Class_12.xlsx` | Grouped by subject. The links sit behind "▶ Watch" text. Accountancy, Commerce and Maths have **one playlist per chapter**. The rest have one playlist for the whole subject, and Chemistry and Physics have channel searches. | **Partly direct** (one playlist per chapter → the first video, with the rest as "more videos"), and partly needs mapping like Class 9. |
| 4 Google Sheets links (in the chat) | Not read yet | Probably Classes 5–8, 10 and 11. Export each one as `.xlsx`, or share it publicly, and the same importer reads it. |

**What this means:**

1. **There are two mediums.** The same chapter has an English-medium video and a Tamil-medium video. The data model stores a `medium` on each video, and the student sees the one that matches their medium, with the other as a fallback.
2. **Ask the team for one template from now on.** Same columns as the Class 4 sheet, one row per video, real links (not "Watch" text), and no channel search links. The importer reports every row it couldn't match, so gaps are visible.

## 3. Key decisions

### 3.1 Hosting and database (free or close to it)

| Piece | Choice | Cost | Why |
| --- | --- | --- | --- |
| App | **Vercel** (Hobby to start, Pro when used by a real school) on the trust's own domain | Free / about $20 a month | Already a Next.js app; custom domain is free. Note: Vercel Hobby is for non-commercial use, which a charitable trust usually fits. |
| Database | **Neon Postgres** (free tier: 0.5 GB, connected through the Vercel Marketplace) | Free | Real Postgres, works well with Vercel serverless, no pausing when idle. 0.5 GB holds several thousand students' marks easily. The next tier is about $19 a month. |
| Data access | Drizzle ORM + Zod validation | — | Typed, light, SQL-like; migrations in the repo. |
| Login | Our own username + password, sessions in an httpOnly cookie stored in the database | Free | No outside sign-in service. Students don't have email. Passwords are hashed (scrypt from `node:crypto`). |
| Textbook PDFs | **Cloudflare R2** | Free up to 10 GB, no download fees | See 3.2. |
| Yearly promotion | **Vercel Cron**, once a day, does nothing except on 1 June | Free | The job only touches rows whose `promoted_for_year` is not this year, so running it twice is harmless. |

Supabase is the other option (database, files and login in one place), but its free projects pause after a week with no traffic and its free file storage is only 1 GB. That doesn't suit a school with holidays.

### 3.2 Where to keep the textbook PDFs

Tamil Nadu textbooks for Classes 4–12, in both mediums, come to roughly **3–8 GB**.

| Option | Good | Bad |
| --- | --- | --- |
| Keep in Google Drive, embed Drive's viewer | No upload, no cost | Every file must be shared publicly. Drive limits heavy traffic ("too many views"). We can't jump to a page. The viewer is slow on phones and doesn't work offline. |
| Put them in Vercel's own storage (Blob) | One vendor | Free tier is too small; download fees add up. |
| **Cloudflare R2 + our own PDF viewer (pdf.js)** ✅ | 10 GB free, **no download fees**, fast in India. We can open **at a chapter's page** and show only that chapter's pages. Works with the browser's cache. | One-time upload (I'll write a script). |

**Plan:** copy the Drive folders to R2 once, with a script. Store one file per book, not per chapter. Each chapter records `book + start page + end page`, so the panel opens on the chapter's first page. The PDFs are fetched through short-lived signed links, so they're only readable by logged-in users.

**Needed from you:** the Drive folders shared with "anyone with the link can view" (or a zip download). The Class 4–10 links are single files or folders. Classes 11–12 have folders for Computer Science, Commerce and Business Maths only, so the others are still missing.

### 3.3 "Like ChatGPT" explanations, made with Gemini

The explanations are **written ahead of time**, checked by a teacher and stored with the lesson. There are no live AI calls while students learn, which means no running cost and no unsafe answers. An "Ask a doubt" button with live AI can come later.

Each lesson's explanation is a short **conversation**:

1. a question a student might ask
2. a simple answer
3. a real-life example from Tamil Nadu life (home, farm, market, festival, cricket, bus)
4. where that example stops working
5. a "check yourself" question

It's written in both Tamil and English.

How we make it:

| Way | Fits |
| --- | --- |
| **Your Gemini subscription in the browser.** I open Gemini, paste one prompt per chapter with the chapter's title, topics and textbook text, and copy the answer back. | The **pilot**: 10–20 chapters, to settle the format and tone. It's slow (a minute or two a chapter) and needs you signed in to Gemini in the app's browser. |
| **A free Gemini API key** from Google AI Studio. This is separate from the subscription, and its free daily limit is enough. A script runs every chapter overnight. | **All ~600 chapters.** Repeatable: if we change the prompt, we re-run it. |

Either way, the output is saved as JSON files in the repo, marked `status: draft`, and a teacher approves each one on a review page before students see it. **Tamil text must be checked by a Tamil teacher.** AI Tamil is often stiff or wrong in grammar.

## 4. Data model (Postgres)

```
users            id, role (admin|teacher|student), username (unique), password_hash,
                 display_name, status (active|archived), created_at, last_login_at
students         user_id, standard (4–12), medium (en|ta), group_id (for 11–12 streams),
                 section?, admission_year, promoted_for_year
sessions         id (random), user_id, expires_at                  -- httpOnly cookie
class_changes    student_id, from, to, reason (auto|admin), by_user, at   -- audit trail

-- content (seeded from curriculum-data.ts + spreadsheets; editable by admin)
chapters         id ("c10-science-ch4"), standard, subject_id, title_en, title_ta, order
textbooks        id, standard, subject_id, medium, r2_key, pages
chapter_pages    chapter_id, textbook_id, start_page, end_page
videos           id, chapter_id, medium, youtube_id, part, title, start_s?, end_s?, source_row
explanations     chapter_id, locale, body_json, status (draft|approved), approved_by

-- assessment
quizzes          id, chapter_id, kind (pop|chapter|assignment), title, created_by,
                 video_id?, at_second?            -- pop quiz pauses the video here
                 due_at?, standard?, published
questions        id, quiz_id, type (mcq|short), prompt_en, prompt_ta, options_json,
                 answer_index?, model_answer?, marks
attempts         id, quiz_id, student_id, started_at, submitted_at, score, max_score, status
answers          attempt_id, question_id, choice?, text?, marks_awarded?, marked_by?
lesson_progress  student_id, chapter_id, video_seconds_watched, completed_at, xp
```

The existing practice questions (684 of 696 chapters have some) are seeded into `questions` as each chapter's default quiz, so every lesson has questions on day one.

## 5. Screens

**Student**
- **Login:** username + password, a language switch, and nothing else.
- **Home:** my class, my subjects, "continue where you left off", assignments due, and my latest scores.
- **Subject → chapter list:** a tick for each finished chapter.
- **Lesson screen:**
  - Wide screens: **video on the left, textbook on the right** (it opens at the chapter's page and the divider can be dragged).
  - Below them: the conversation-style explanation, then a "Finish lesson" quiz.
  - Phones: Video | Textbook | Explanation tabs.
  - Pop quizzes **pause the video** at set times and show one or two questions. A wrong answer offers "rewind 30 s".
- **Assignments:** list, take, submit; then see marks and the teacher's feedback.

**Teacher**
- Class picker (any class).
- Student list with each student's average.
- **Gradebook:** students × quizzes and assignments, with export to Excel.
- **Make a quiz or assignment:** pick questions from the chapter bank or write new ones; set a due date. For a pop quiz, pick the video and the second it pauses at.
- **Marking queue** for short answers.
- **Explanation review**: approve or edit drafts.

**Admin**
- Everything a teacher has, plus:
  - Students: add, **bulk import from Excel**, change class, reset password, archive/restore, print login slips.
  - Teachers: add, reset, remove.
  - Content: import the video spreadsheets (showing a report of unmatched rows), upload textbooks and set chapter page ranges.
  - Settings: academic year and promotion date.

## 6. Build order

Each phase ends deployed and working, not half-done.

| # | Phase | Ends with |
| --- | --- | --- |
| **1** | **Foundation**: Neon + Drizzle, users/students/sessions tables, login and logout, role checks in a `proxy.ts` (what Next.js 16 calls middleware), hide Classes 1–3, admin page to create students and teachers + bulk Excel import, yearly promotion job + "change class". | An admin creates a student, the student logs in and sees only their class. |
| **2** | **Content import**: seed chapters into the database; video spreadsheet importer (Class 4 now, the rest as sheets arrive) with an unmatched-rows report; R2 upload script for PDFs; chapter page ranges. | Every Class 4 chapter has its video; PDFs are in R2. |
| **3** | **Lesson screen**: YouTube player (official IFrame API), PDF panel (pdf.js, opens at the page), mobile tabs, progress saved on the server (replacing `localStorage`; the device copy stays as an offline cache). | A student watches a Class 4 lesson next to the textbook and their progress is on the server. |
| **4** | **Quizzes**: chapter quiz from the question bank, pop quizzes at video times, scores saved. Teacher pop-quiz editor. | Pop quiz pauses the video; teacher sees the score. |
| **5** | **Assignments + gradebook**: create/assign/due date, MCQ auto-marking, short-answer marking queue, gradebook + Excel export, student "my marks". | One assignment can be set, submitted, marked and seen in the gradebook. |
| **6** | **Explanations**: Gemini pilot in the browser (10–20 chapters), settle the format; then the API run for the rest; teacher review page. | Approved explanations show in the lesson. |
| **7** | **Full Tamil**: move every UI string into one dictionary (`en`/`ta`), a test that fails if a Tamil string is missing or is English, and a Tamil teacher's check. Fix the practice questions that have Tamil text in their English fields. | No English text in Tamil mode. |
| **8** | **Launch**: trust's domain on Vercel, backups (Neon keeps 1 day on the free tier, plus a weekly `pg_dump` from a GitHub Action), privacy notice for parents, load test with about 100 students. | Live. |

Phases 1–5 are the core. Phase 6 can run alongside from phase 3, and phase 7 alongside from phase 4.

## 7. Privacy (these are children)

- Collect only: name, class, medium, and the username and password the admin issues. No phone numbers, emails or photos.
- Students' marks are visible only to that student, to teachers and to admins.
- Archived students are deleted completely after a period the trust decides (for example 3 years), with a parent's request honoured sooner, in line with India's DPDP Act.
- YouTube is embedded in privacy-enhanced mode (`youtube-nocookie.com`).

## 8. Needed from the team

1. The 4 Google Sheets exported as `.xlsx`, or shared with "anyone with the link". Ideally all classes in the Class 4 sheet's columns, one row per video.
2. Proper playlists or videos instead of the **channel search links** (Class 9 Maths, Science, Social; Class 12 Chemistry, Physics).
3. Textbook Drive folders shared with "anyone with the link", plus the missing Class 11–12 subjects.
4. A Neon account and a Cloudflare account in the trust's name (both free; I'll walk through it), and access to the domain's DNS.
5. A Tamil teacher to check Tamil text, and a teacher per subject to approve explanations.
6. For Gemini: sign in to Gemini in the app's browser for the pilot; later, a free AI Studio API key in the trust's Google account.

## 9. Progress

### Phase 1 — Foundation: built 2026-11-19

What exists now (all in `frontend/`):

| Piece | Where |
| --- | --- |
| Tables: users, students, sessions, class changes, settings, promotion runs | `src/server/db/schema.ts`, migration `drizzle/0000_init.sql` |
| Database connection: Neon/Postgres when `DATABASE_URL` is set, otherwise an embedded Postgres (PGlite) in `.data/pglite` | `src/server/db/` |
| Passwords (scrypt), sessions (httpOnly cookie, SHA-256 of the token stored), lock after 10 wrong passwords for 15 min | `src/server/auth/` |
| Accounts, class changes, password reset, archive/restore, yearly promotion | `src/server/people.ts` |
| Excel/CSV student import (English or Tamil column names) + template | `src/server/student-import.ts` |
| Sign-in page (`/sign-in`), sign-out, `/api/auth/me` | `src/app/sign-in/`, `src/app/api/auth/me/` |
| Signed-out visitors to `/m/*`, `/admin/*`, `/teacher/*`, `/me` are sent to sign-in | `src/proxy.ts` |
| Admin area: overview, students (list, add, import, detail), teachers & admins, settings | `src/app/admin/`, `src/modules/staff/` |
| Teacher area: every class, its students, open its lessons | `src/app/teacher/` |
| Daily promotion job (Vercel Cron, 01:00 IST) | `src/app/api/cron/promote/`, `vercel.json` |
| Students see only their own class; staff can switch class; Classes 1–3 hidden from the class picker | `components/session-user.tsx`, learn and grow screens |

Removed: the old `/api/profile` route that kept one profile for everyone.

Not yet: progress still lives on the device (Phase 3 moves it to the server). On a shared device, signing in as a different account starts that device's progress fresh.

**Run locally**

```
npm run db:seed-dev      # once, with the dev server stopped: admin, teacher, 4 students → .data/dev-logins.txt
npm run dev
```

**Deploy to Vercel**

1. Create a Neon project (free) and copy its *pooled* connection string.
2. In Vercel → Settings → Environment Variables add `DATABASE_URL` and `CRON_SECRET` (any long random string).
3. Nothing to change in the build settings: Vercel runs the `vercel-build` script automatically (applies migrations, then builds).
4. Create the first admin from your computer: `DATABASE_URL=… npm run admin:create -- --username office --name "Kalpavriksha Office"`. It prints the password once.
5. Add the trust's domain in Vercel → Domains.
