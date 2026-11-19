# Kalpavriksha — Learning portal plan

Status: draft · 2026-11-15
Companion to [`backend-plan.md`](backend-plan.md) (how it is built). This file is **what** we build and **why**.

## 1. Who it's for

- Kalpavriksha Seva Trust students, Classes 1–12, Tamil Nadu State Board (Samacheer Kalvi), Tamil and English.
- Often on shared, low-end Android phones or centre PCs, with patchy or metered internet.
- Many study in Tamil at home and face English-medium terms in school and exams.
- Supported by volunteers and teachers at centres, not full-time tutors at home.

So every feature must: work in Tamil and English, work on a cheap phone, degrade gracefully offline, and be maintainable by volunteers.

## 2. Where we are

| Area | Today |
| --- | --- |
| Digital Learning (`/m/learn`) | 696 chapters for Classes 1–12, practice questions on 684 of them, textbook PDF links, read-aloud with highlighting |
| Holistic Growth (`/m/grow`) | Growth tree, 6-area radar, activity log, badges, learning-track card |
| GK & Songs (`/m/gk-songs`) | Timed GK quiz by level, sing-along patriotic songs |
| Motivation | XP, levels, streaks, 7 badges (device-only) |
| **Not real yet** | Video lessons (placeholder), real-life analogies (one generic template text for every chapter), accounts, teacher view, offline downloads |

## 3. The learning loop

Every chapter follows the same five steps. Each feature below plugs into one step.

```
 1 UNDERSTAND  →  2 PRACTISE  →  3 REMEMBER  →  4 APPLY  →  5 REFLECT
 video, analogy,   checkpoint      daily review,   try-at-home    growth tree,
 bilingual text,   quizzes,        mistake         missions,      badges, teacher
 simulations       worked steps    notebook        projects       feedback
```

## 4. Feature catalogue

Effort: S = days, M = 1–2 weeks, L = 3+ weeks. "AI" means it needs a paid AI service at runtime (we avoid these in early phases).

### 4.1 Understand

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| U1 | **Interactive video lessons** | Video pauses for a question; wrong answer → hint, textbook page, rewind 30 s. Details in `backend-plan.md` §6a | M | No |
| U2 | **Real-Life Analogy cards ("Life Link")** | See §5 — the flagship new module | M | No (AI only to draft offline) |
| U3 | **Bilingual side-by-side reading** | Tap a toggle to show Tamil and English lines side by side, or one at a time | S | No |
| U4 | **Tap-a-word glossary** | Tap any key term → meaning in simple Tamil + English, a picture, and the Tamil technical term (e.g. photosynthesis ↔ ஒளிச்சேர்க்கை) | M | No |
| U5 | **Three depths of explanation** | "Simple / Normal / Deep" switch on each concept, so a struggling Class 8 student can read the simple version | M | No |
| U6 | **Step-by-step worked examples** | Maths/physics problems reveal one step at a time; "why this step?" under each | M | No |
| U7 | **Hands-on simulations** | Fraction pizza, number line, balance-scale equations, simple circuit, Tamil Nadu map. Start with free open simulations (e.g. PhET, licence CC-BY — check Tamil availability) before building our own | M–L | No |
| U8 | **Textbook QR bridge** | Scan the QR printed in the government textbook (or a sticker we print) → opens that chapter in the app. Links the paper book to the portal | S | No |
| U9 | Audio / podcast mode | Chapter summary as audio (recorded by volunteers or TTS), playable with the screen off; good for low data | S | No |

### 4.2 Practise

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| P1 | Video checkpoint quizzes | Part of U1 | — | No |
| P2 | **Hints before answers** | First wrong try → hint; second → the analogy card; third → full explanation. Never just "Wrong" | S | No |
| P3 | **Adaptive difficulty** | Questions tagged easy/medium/hard; two right in a row steps up, two wrong steps down | M | No |
| P4 | **Board exam mode** (Classes 10 & 12, later 11) | Timed papers in the TN board pattern (1/2/5-mark), previous-year questions, self-marking with model answers | M | No |
| P5 | Fill-the-blank and match-the-pair games | Quick games built from glossary and key points; fun for Classes 1–5 | S | No |

### 4.3 Remember

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| R1 | **"Daily 5" review** | Five questions a day from chapters already done, spaced out (Leitner boxes: 1, 3, 7, 14, 30 days). One of the highest-value, lowest-cost features | S | No |
| R2 | **Mistake notebook** | Every wrong answer saved with its explanation and analogy; "retry my mistakes" button | S | No |
| R3 | Flashcards | Auto-made from the glossary; swipe know / don't know | S | No |
| R4 | **One-page revision sheet** | Per chapter: key points, formulas, analogy, textbook pages, video timestamps. Printable for students without phones at exam time | S | No |

### 4.4 Apply

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| A1 | **Try-at-home missions** | One small task per chapter with household things: measure your shadow at 9am and 12pm; work out the cost per kg at the local market; find three simple machines in the kitchen. Completing one logs an activity in the Grow module | M (mostly content) | No |
| A2 | Local data projects (Classes 8–12) | Maths and science on real Tamil Nadu data: rainfall, crop prices, bus timetables | M | No |
| A3 | Career connection | "Who uses this?" line per chapter (nurse, electrician, farmer, coder) linking to the career explorer (W2) | S | No |

### 4.5 Reflect & motivate

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| M1 | **Learning tree** | Each finished chapter grows a leaf; each subject is a branch. Builds on the existing growth tree | S | No |
| M2 | **Centre goals, not leaderboards** | "Our centre's tree needs 500 leaves this week." Cooperative, so weaker students aren't shamed | S | No |
| M3 | More badges | Analogy maker, 7-day review streak, mistake master, mission explorer | S | No |
| M4 | Printable certificates | Subject or term completion, signed by the trust | S | No |
| M5 | "How did that feel?" check | One-tap emoji after a chapter (easy / ok / hard). Feeds teacher view; hard chapters get flagged | S | No |

### 4.6 Help

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| H1 | **Doubt box** | Ask a question (typed or voice) on any chapter; volunteer mentors answer within a day; good answers become the chapter FAQ | M | No |
| H2 | AI study buddy (later, optional) | Answers only from that chapter's textbook and our content, gives hints not answers, logs reviewed by teachers, can be switched off per centre | L | **Yes** |

### 4.7 Wellbeing & future (Grow module)

| # | Feature | What the student sees | Effort | AI |
| --- | --- | --- | --- | --- |
| W1 | Mood check-in | Optional weekly check-in; a volunteer sees a quiet flag if a student keeps choosing "sad" | S | No |
| W2 | **Career & stream explorer** (Classes 9–12) | Which Class 11 group (the app already has the 6 TN groups) leads to which courses and jobs; entrance exams; Tamil Nadu scholarships and schemes, with official links | M | No |
| W3 | Life skills track | Money basics, digital safety, first aid, communication; short lessons that log into the growth radar | M | No |

### 4.8 For teachers, volunteers and parents

| # | Feature | Effort |
| --- | --- | --- |
| T1 | **Class dashboard**: who hasn't opened the app, who is stuck, most-missed questions, chapters marked "hard" | M |
| T2 | Assign chapters / missions to a class with a due date | S |
| T3 | **Content studio**: write analogies, questions, glossary, video checkpoints; draft → review → published | M |
| T4 | Printed weekly report per student (for parents without smartphones); optional SMS later, only with consent | S |

### 4.9 Access for everyone

| # | Feature | Effort |
| --- | --- | --- |
| X1 | **Offline chapter download**: text, audio, questions, analogies (videos only when we host them ourselves) | M |
| X2 | Low-data mode: no 3D/animation, compressed images, no autoplay | S |
| X3 | Shared-device quick switch: pick your avatar, enter your PIN | S |
| X4 | Accessibility: larger text, dyslexia-friendly font, high contrast, captions, read-aloud speed, Tamil keyboard input | S–M |

## 5. Real-Life Analogy module ("Life Link") — detailed design

**Why.** Abstract ideas stick when tied to something the child already knows. For these students that means Tamil Nadu daily life: the kitchen, the market, the farm, the bus, cricket, festivals, the temple tank, the ration shop.

**Examples**

| Concept | Class | Analogy |
| --- | --- | --- |
| Fractions | 3–5 | Sharing 8 idlis among 4 people; half a dosa vs a quarter dosa |
| Electric current, voltage, resistance | 8–10 | Water from the overhead tank: tank height = voltage, flow = current, a thin pipe = resistance |
| Cell organelles | 9 | The cell as a village: nucleus = panchayat office, mitochondria = the EB power station, cell membrane = the village gate and watchman |
| Ratio & proportion | 7 | Rice-to-water ratio when cooking; doubling a recipe |
| Democracy & elections | 8 | Choosing a class leader |
| Photosynthesis | 7 | The leaf as a kitchen: sunlight is the stove, water and CO₂ are ingredients, sugar is the meal |
| Computer memory (RAM vs storage) | 11 CS | RAM is your desk while studying; storage is your cupboard |

**What each analogy card holds**
- Concept it explains, chapter, and the grade band (Seedlings / Saplings / Tall Trees).
- The analogy in Tamil and English, 2–4 short sentences.
- A simple drawing (optional).
- **"Where it breaks"** line — every analogy has limits; saying so stops misconceptions (e.g. "unlike water, electrons are already in the wire").
- Theme tag: kitchen, farm, sports, market, festival, travel, games.

**Where it appears**
1. A "Explain with real life" button on each concept in the chapter reader.
2. After a second wrong answer at a video checkpoint or quiz (P2).
3. On the one-page revision sheet (R4).

**Cool extras (phase C)**
- **Theme switcher**: the same concept explained through cricket, the kitchen or the farm; student picks what clicks.
- **"Did this help?"** 👍/👎 — teachers see which analogies work and rewrite weak ones.
- **Student analogies**: students write their own analogy; teacher approves; best ones are published with the student's first name and a badge. Teaching others is the strongest test of understanding.

**How content gets made (no runtime AI)**
1. List key concepts per chapter (start with the pilot class/subject).
2. Draft analogies offline — volunteers, or an AI tool used by a volunteer to produce drafts.
3. A teacher checks accuracy and the "where it breaks" line, translates/checks Tamil, and publishes.
4. Roughly 3–5 concepts per chapter × 10 minutes each.

**Data (adds to `backend-plan.md` §4)**
```
concepts   id, chapter_id, name (en/ta), glossary_definition (en/ta), tamil_term, sort_order
analogies  id, concept_id, band, theme, body (en/ta), breaks_down (en/ta), image_url,
           status (draft|review|published), author_type (staff|student), author_id,
           helpful_up, helpful_down, created_at, published_at
```

## 6. Roadmap

Each phase ends with something students can use. Backend phases refer to `backend-plan.md` §7.

**Phase A — Honest foundation (≈ 3 weeks)**

> Progress 2026-11-15 (device-only, no backend yet): mock profile bugs fixed; fake video card, fake audio/file sizes, filler fill-blank/true-false/match questions and the template "Real-World Applications" text removed; R1 Daily 5, R2 mistake notebook, P2 hints-before-answers and the core U2 Life Link module (with theme switcher and "did this help?") built. Life Link seed content: 20 concepts (24 analogies) across 37 chapters, covering 9 of 12 Class 10 Science units; Tamil wording still needs a teacher check. Still to do in Phase A: backend Phases 1–2, U3 bilingual side-by-side.

- Backend Phases 0–2: fix mock bugs, remove the fake video card and the generic "Real-World Applications" template text, accounts, progress sync.
- R1 Daily 5, R2 Mistake notebook, P2 hints-before-answers (all use the existing 684 chapters' questions).
- U3 bilingual side-by-side, X2 low-data mode.

**Phase B — Pilot: one class, one subject (≈ 4–6 weeks)**
Pick one (suggested: Class 10 Science or Maths, because of the board exam).
- U1 interactive videos + T3 content studio + T1 class dashboard (backend Phases 3 and 3b).
- U2 Life Link analogy cards (core version), U4 glossary.
- R4 revision sheet, A1 try-at-home missions, M1 learning tree, M5 "how did that feel?".
- Test with real students at one centre for 4 weeks. Measure (§8), then fix.

> Progress 2026-11-15 (performance): the curriculum dataset moved out of the browser bundle. `lib/curriculum-data.ts` (server only) feeds prerendered routes `/api/curriculum/outline/[standard]` (15–75 KB per class) and `/api/curriculum/chapter/[chapterId]` (~2–5 KB); `lib/curriculum-client.ts` fetches and caches them. Module pages dropped a 2.57 MB chunk; initial JS is now ~1.07 MB (325 KB gzipped). `curriculum-split.test.ts` fails if a client file imports the dataset again. Landing-page scrolling no longer re-renders React per frame.

**Phase C — Expand content and depth (ongoing)**
- Roll out subject by subject using the content studio.
- P4 board exam mode, P3 adaptive difficulty, U6 worked examples, U8 textbook QR bridge.
- Analogy extras: theme switcher, "did this help?", student-written analogies.
- H1 doubt box, W2 career explorer, X1 offline downloads, M2 centre goals, M4 certificates.

**Phase D — Optional AI (only if funded and safe)**
- H2 AI study buddy limited to the textbook, teacher-reviewed.
- AI rubric grading of written answers; spoken explanations ("Feynman mode") — needs parental consent for voice.

## 7. What we deliberately won't do (for now)

- Public leaderboards ranking children against each other.
- Chat between students without moderation.
- Collecting photos of children, phone numbers or emails of students.
- Any AI answering students live before Phase D, and never without teacher review.
- Fake or placeholder content shown as real ("verified", made-up durations).

## 8. How we'll know it works

| Measure | Pilot target |
| --- | --- |
| Students active ≥ 3 days a week | 60% |
| Daily 5 completed | 50% of active days |
| Checkpoint questions right on first try | rising week over week |
| Chapters marked "hard" | falling after analogies are added |
| Analogy 👍 rate | ≥ 70% |
| Teacher time per published chapter (video + analogies + checks) | ≤ 45 min |
| Term exam scores, pilot vs non-pilot students (same centre) | compare at term end |

## 9. Open decisions

1. Pilot class and subject.
2. Who writes content: how many volunteers, how many hours a week? This sets the pace more than code does.
3. Video source: curated YouTube first, or record our own (see `backend-plan.md` §9).
4. Is AI-assisted drafting of analogies and questions (reviewed by a teacher) acceptable to the trust?
5. Parent contact: printed reports only, or SMS/WhatsApp with consent?
