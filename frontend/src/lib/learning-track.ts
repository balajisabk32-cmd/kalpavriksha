import type { LocalizedText } from "@/lib/i18n";
import { levelOf, streak, localDay, type Progress } from "@/lib/progress";
import { isSupportedStandard, type SupportedStandard } from "@/lib/curriculum";

/**
 * The subject shape the track needs. Both the full curriculum (server, tests)
 * and the per-class outline the browser fetches (`useStandardOutline`) fit it.
 */
export type TrackSubject = {
  readonly id: string;
  readonly name: LocalizedText;
  readonly code: string;
  readonly accent: string;
  readonly icon: string;
  readonly chapters: readonly { readonly id: string; readonly title: LocalizedText }[];
};

export type SubjectProgress = {
  readonly id: string;
  readonly name: LocalizedText;
  readonly code: string;
  readonly accent: string;
  readonly icon: string;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly percentage: number;
  readonly isComplete: boolean;
  readonly status: "completed" | "in-progress" | "not-started";
};

export type LearningTrackStats = {
  readonly standard: SupportedStandard;
  readonly totalChaptersInStandard: number;
  readonly completedChaptersInStandard: number;
  readonly standardPercentage: number;
  readonly totalLessonsDoneOverall: number;
  readonly quizBest: number;
  readonly xp: number;
  readonly level: { level: number; into: number; span: number };
  readonly streakDays: number;
  readonly subjects: readonly SubjectProgress[];
  readonly lastAccessed?: {
    readonly standard: number;
    readonly subjectId: string;
    readonly chapterId: string;
    readonly subjectName: LocalizedText;
    readonly chapterTitle: LocalizedText;
    readonly timestamp: string;
  };
  readonly nextRecommendedChapter?: {
    readonly standard: number;
    readonly subjectId: string;
    readonly chapterId: string;
    readonly subjectName: LocalizedText;
    readonly chapterTitle: LocalizedText;
  };
};

/** Which class the track is about: override → profile grade → last opened chapter's class → 6. */
export function resolveTrackStandard(progress: Progress, standardOverride?: number): SupportedStandard {
  let standard: SupportedStandard = 6;
  if (standardOverride && isSupportedStandard(standardOverride)) {
    standard = standardOverride;
  } else if (progress.profile && isSupportedStandard(progress.profile.grade)) {
    standard = progress.profile.grade;
  } else if (
    progress.profile?.lastAccessed &&
    isSupportedStandard(progress.profile.lastAccessed.standard)
  ) {
    standard = progress.profile.lastAccessed.standard;
  }
  return standard;
}

/**
 * Progress through one class's chapters. `subjectsFor` supplies that class's
 * subjects (an empty list while the browser is still fetching them).
 */
export function getLearningTrackStats(
  progress: Progress,
  subjectsFor: (standard: SupportedStandard) => readonly TrackSubject[],
  standardOverride?: number,
  today = localDay(),
): LearningTrackStats {
  const standard = resolveTrackStandard(progress, standardOverride);
  const subjects = subjectsFor(standard);
  const doneSet = new Set(progress.lessonsDone);

  const subjectProgressList: SubjectProgress[] = subjects.map((s) => {
    const total = s.chapters.length;
    const completed = s.chapters.filter((ch) => doneSet.has(ch.id)).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isComplete = total > 0 && completed === total;
    const status: SubjectProgress["status"] = isComplete
      ? "completed"
      : completed > 0
        ? "in-progress"
        : "not-started";

    return {
      id: s.id,
      name: s.name,
      code: s.code,
      accent: s.accent || "var(--violet)",
      icon: s.icon || "book",
      totalChapters: total,
      completedChapters: completed,
      percentage,
      isComplete,
      status,
    };
  });

  const totalChaptersInStandard = subjectProgressList.reduce(
    (acc, curr) => acc + curr.totalChapters,
    0,
  );
  const completedChaptersInStandard = subjectProgressList.reduce(
    (acc, curr) => acc + curr.completedChapters,
    0,
  );
  const standardPercentage =
    totalChaptersInStandard > 0
      ? Math.round((completedChaptersInStandard / totalChaptersInStandard) * 100)
      : 0;

  // Resolve last accessed chapter metadata if present
  let lastAccessedMeta: LearningTrackStats["lastAccessed"];
  if (
    progress.profile?.lastAccessed &&
    progress.profile.lastAccessed.standard === standard
  ) {
    const { subjectId, chapterId } = progress.profile.lastAccessed;
    const subject = subjects.find((s) => s.id === subjectId);
    const chapter = subject?.chapters.find((c) => c.id === chapterId);
    const data = subject && chapter ? { subject, chapter } : undefined;
    if (data) {
      lastAccessedMeta = {
        standard,
        subjectId: data.subject.id,
        chapterId: data.chapter.id,
        subjectName: data.subject.name,
        chapterTitle: data.chapter.title,
        timestamp: progress.profile.lastAccessed.timestamp,
      };
    }
  }

  // Resolve next recommended chapter
  let nextRecommended: LearningTrackStats["nextRecommendedChapter"];

  // 1. If last accessed chapter is incomplete, recommend continuing it
  if (
    lastAccessedMeta &&
    !doneSet.has(lastAccessedMeta.chapterId)
  ) {
    nextRecommended = {
      standard,
      subjectId: lastAccessedMeta.subjectId,
      chapterId: lastAccessedMeta.chapterId,
      subjectName: lastAccessedMeta.subjectName,
      chapterTitle: lastAccessedMeta.chapterTitle,
    };
  } else {
    // 2. Otherwise look for the next uncompleted chapter in the current standard
    for (const sub of subjects) {
      const nextUnfinished = sub.chapters.find((ch) => !doneSet.has(ch.id));
      if (nextUnfinished) {
        nextRecommended = {
          standard,
          subjectId: sub.id,
          chapterId: nextUnfinished.id,
          subjectName: sub.name,
          chapterTitle: nextUnfinished.title,
        };
        break;
      }
    }
  }

  return {
    standard,
    totalChaptersInStandard,
    completedChaptersInStandard,
    standardPercentage,
    totalLessonsDoneOverall: progress.lessonsDone.length,
    quizBest: progress.quizBest,
    xp: progress.xp,
    level: levelOf(progress.xp),
    streakDays: streak(progress.activeDays, today),
    subjects: subjectProgressList,
    lastAccessed: lastAccessedMeta,
    nextRecommendedChapter: nextRecommended,
  };
}
