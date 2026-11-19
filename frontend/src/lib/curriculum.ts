/**
 * Curriculum: types, constants and the light helpers that are safe on the client.
 * The 696-chapter dataset is in `curriculum-data.ts` (server and tests only).
 */
import type { Locale, LocalizedText } from "@/lib/i18n";

export type ResourceType = "text" | "pdf" | "video" | "audio" | "practice" | "link";

export const TN_TEXTBOOK_PORTAL_URL = "https://share.google/DWaDvFsGIVE5d4HHs";
export const TN_NEW_SYLLABUS_2026_27_URL = "https://share.google/qaF2Aopcl5hgnN7p0";
export const TN_CLASS_1_2_3_NEW_TEXTBOOKS_URL = "https://share.google/KPUGozoLZRzEdc9wP";
export const TN_11TH_TEXTBOOKS_URL = "https://www.tntextbooks.net/p/11th-books.html";
export const TN_12TH_TEXTBOOKS_URL = "https://www.tntextbooks.net/p/12th-books.html";

/** Official Tamil Nadu State Board (Samacheer Kalvi) Textbooks reference links */
export const TN_OFFICIAL_TEXTBOOK_LINKS = [
  {
    id: "tn-11th-textbooks",
    title: {
      en: "TN 11th Standard Textbooks (Volume 1 & 2) - tntextbooks.net",
      ta: "வகுப்பு 11 பாடப்புத்தகங்கள் (தொகுதி 1 & 2) - tntextbooks.net",
      hi: "कक्षा 11 पाठ्यपुस्तकें (भाग 1 & 2)",
    },
    shortTitle: {
      en: "11th Textbooks",
      ta: "11ஆம் வகுப்பு புத்தகங்கள்",
      hi: "11वीं पुस्तकें",
    },
    url: TN_11TH_TEXTBOOKS_URL,
    badge: "11th Std",
    description: {
      en: "Direct PDF download link for Class 11 all streams (Science, Commerce, Arts) Volume 1 & 2.",
      ta: "11ஆம் வகுப்பு அனைத்துப் பாடப் பிரிவுகளுக்கான (அறிவியல், வணிகவியல்) பாடநூல் பதிவிறக்கம்.",
      hi: "कक्षा 11 सभी विषयों की पाठ्यपुस्तकों का सीधा डाउनलोड लिंक।",
    },
  },
  {
    id: "tn-12th-textbooks",
    title: {
      en: "TN 12th Standard Textbooks (Volume 1 & 2) - tntextbooks.net",
      ta: "வகுப்பு 12 பாடப்புத்தகங்கள் (தொகுதி 1 & 2) - tntextbooks.net",
      hi: "कक्षा 12 पाठ्यपुस्तकें (भाग 1 & 2)",
    },
    shortTitle: {
      en: "12th Textbooks",
      ta: "12ஆம் வகுப்பு புத்தகங்கள்",
      hi: "12वीं पुस्तकें",
    },
    url: TN_12TH_TEXTBOOKS_URL,
    badge: "12th Std",
    description: {
      en: "Direct PDF download link for Class 12 board exam subjects Volume 1 & 2.",
      ta: "12ஆம் வகுப்பு பொதுத்தேர்வு பாடங்களுக்கான பாடநூல் பதிவிறக்கம்.",
      hi: "कक्षा 12 बोर्ड परीक्षा विषयों की पाठ्यपुस्तकों का सीधा डाउनलोड लिंक।",
    },
  },
  {
    id: "tn-new-syllabus-2026-27",
    title: {
      en: "New Syllabus Textbooks (From 2026 - 27) - Direct Download Link - Tnkalvi .net",
      ta: "புதிய பாடத்திட்ட பாடநூல்கள் (2026 - 27 முதல்) - நேரடி பதிவிறக்கம் (Tnkalvi.net)",
      hi: "नई पाठ्यचर्या पुस्तकें (2026 - 27 से) - सीधा डाउनलोड लिंक",
    },
    shortTitle: {
      en: "New Syllabus (2026–27)",
      ta: "புதிய பாடத்திட்டம் (2026-27)",
      hi: "नया सिलेबस (2026–27)",
    },
    url: TN_NEW_SYLLABUS_2026_27_URL,
    badge: "2026–27 Direct",
    description: {
      en: "Direct PDF download link for the newly updated Tamil Nadu school curriculum textbooks.",
      ta: "தமிழ்நாடு பள்ளிக் கல்வித் துறையின் புதிய பாடத்திட்ட பாடநூல்களின் நேரடி பதிவிறக்கம்.",
      hi: "अद्यतन तमिलनाडु स्कूल पाठ्यक्रम पाठ्यपुस्तकों का सीधा पीडीएफ डाउनलोड लिंक।",
    },
  },
  {
    id: "tn-textbook-portal",
    title: {
      en: "Tamilnadu School Textbooks",
      ta: "தமிழ்நாடு பள்ளி பாடநூல்கள்",
      hi: "तमिलनाडु स्कूल पाठ्यपुस्तकें",
    },
    shortTitle: {
      en: "TN School Textbooks",
      ta: "தமிழ்நாடு பள்ளி பாடநூல்கள்",
      hi: "टीएन स्कूल पाठ्यपुस्तकें",
    },
    url: TN_TEXTBOOK_PORTAL_URL,
    badge: "Official Portal",
    description: {
      en: "Official repository of Tamil Nadu State Board textbooks for all classes (Tamil & English medium).",
      ta: "அனைத்து வகுப்புகளுக்கான தமிழ்நாடு மாநில பாடநூல் கழகத்தின் அதிகாரப்பூர்வ களஞ்சியம்.",
      hi: "सभी कक्षाओं के लिए तमिलनाडु स्टेट बोर्ड की आधिकारिक पाठ्यपुस्तकें।",
    },
  },
  {
    id: "tn-primary-1-2-3",
    title: {
      en: "TN Class 1, 2, 3 New Textbooks 2026–2027 PDF Download – Tamil & English Medium",
      ta: "வகுப்பு 1, 2, 3 புதிய பாடநூல்கள் 2026–2027 PDF பதிவிறக்கம் – தமிழ் & ஆங்கில வழி",
      hi: "कक्षा 1, 2, 3 नई पाठ्यपुस्तकें 2026-2027 पीडीएफ डाउनलोड",
    },
    shortTitle: {
      en: "Class 1, 2, 3 New Textbooks",
      ta: "வகுப்பு 1, 2, 3 பாடநூல்கள்",
      hi: "कक्षा 1, 2, 3 नई पुस्तकें",
    },
    url: TN_CLASS_1_2_3_NEW_TEXTBOOKS_URL,
    badge: "Primary 1–3",
    description: {
      en: "Direct PDF download for Class 1, 2, and 3 foundational stage textbooks in Tamil & English mediums.",
      ta: "தொடக்கக் கல்வி வகுப்பு 1, 2, 3 பாடநூல்களின் இலவச PDF பதிவிறக்க இணைப்பு.",
      hi: "कक्षा 1, 2 और 3 के लिए प्राथमिक स्तर की नई पाठ्यपुस्तकों का पीडीएफ डाउनलोड।",
    },
  },
] as const;

export type ResourceItem = {
  readonly id: string;
  readonly title: LocalizedText;
  readonly type: ResourceType;
  readonly url: string;
  readonly description?: LocalizedText;
  readonly durationMinutes?: number;
  readonly available: boolean;
};

export type PracticeQuestion = {
  readonly id: string;
  readonly question: LocalizedText;
  readonly options: readonly LocalizedText[];
  readonly answerIndex: number;
  readonly explanation: LocalizedText;
};

export type CurriculumChapter = {
  readonly id: string;
  readonly chapterNumber: number;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly lessonLines: readonly string[];
  readonly lessonLang: Locale;
  readonly resources: readonly ResourceItem[];
  readonly practiceQuestions?: readonly PracticeQuestion[];
  readonly estimatedMinutes: number;
  readonly icon?: string;
};

export type SubjectStream = "general" | "science" | "commerce" | "arts";

export type CurriculumSubject = {
  readonly id: string;
  readonly code: string;
  readonly name: LocalizedText;
  readonly accent: string;
  readonly icon: "tamil" | "english" | "math" | "science" | "social" | "physics" | "chemistry" | "biology" | "computer" | "commerce";
  readonly description: LocalizedText;
  readonly stream: SubjectStream;
  readonly textbookUrl: string;
  readonly chapters: readonly CurriculumChapter[];
};

export type StandardCurriculum = {
  readonly standard: number;
  readonly name: LocalizedText;
  readonly stage: "primary" | "middle" | "secondary" | "higher_secondary";
  readonly subjects: readonly CurriculumSubject[];
};

/**
 * What the dashboards need: every field except the heavy per-chapter content.
 * Served per class by `/api/curriculum/outline/[standard]`; the full chapter
 * (lesson text, questions, resources) comes from `/api/curriculum/chapter/[id]`
 * only when a chapter is opened. The data itself lives in `curriculum-data.ts`,
 * which must never be imported by client components (see curriculum-split.test.ts).
 */
export type ChapterOutline = Omit<CurriculumChapter, "lessonLines" | "practiceQuestions" | "resources"> & {
  readonly questionCount: number;
};
export type SubjectOutline = Omit<CurriculumSubject, "chapters"> & { readonly chapters: readonly ChapterOutline[] };
export type StandardOutline = Omit<StandardCurriculum, "subjects"> & { readonly subjects: readonly SubjectOutline[] };

/** A subject's own fields, without its chapter list. */
export type SubjectMeta = Omit<CurriculumSubject, "chapters">;
/** A chapter in a list (prev/next navigation, search), with its subject. */
export type ChapterRef = { readonly subject: SubjectMeta; readonly chapter: ChapterOutline };

/** A full chapter with the subject it belongs to (no sibling chapters). */
export type ChapterDetail = {
  readonly standard: number;
  readonly subject: SubjectMeta;
  readonly chapter: CurriculumChapter;
};

/** Drop the heavy fields from a chapter (lesson text, questions, resources). */
export function toChapterOutline(chapter: CurriculumChapter): ChapterOutline {
  const outline: Record<string, unknown> = { ...chapter, questionCount: chapter.practiceQuestions?.length ?? 0 };
  delete outline.lessonLines;
  delete outline.practiceQuestions;
  delete outline.resources;
  return outline as ChapterOutline;
}

/** A subject's own fields, without its chapter list. */
export function toSubjectMeta(subject: { readonly chapters: unknown } & SubjectMeta): SubjectMeta {
  const meta: Record<string, unknown> = { ...subject };
  delete meta.chapters;
  return meta as SubjectMeta;
}

export const SUPPORTED_STANDARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type SupportedStandard = (typeof SUPPORTED_STANDARDS)[number];

export function isSupportedStandard(val: unknown): val is SupportedStandard {
  return typeof val === "number" && (SUPPORTED_STANDARDS as readonly number[]).includes(val);
}

// ============================================================================
// HIGHER SECONDARY GROUPS / STREAMS (Class 11 & 12)
// ============================================================================

export type SeniorGroupId =
  | "cs"
  | "biology"
  | "pure_science"
  | "commerce"
  | "commerce_ca"
  | "business_maths";

export interface SeniorGroupDefinition {
  readonly id: SeniorGroupId;
  readonly code: string;
  readonly badge: string;
  readonly accent: string;
  readonly iconName: "computer" | "commerce" | "math" | "science";
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly electiveCodes: readonly string[]; // 4 core group subjects
  readonly allGroupCodes: readonly string[]; // 4 electives + TAM & ENG
}

export const SENIOR_GROUPS: readonly SeniorGroupDefinition[] = [
  {
    id: "cs",
    code: "GROUP-1",
    badge: "Computer Science",
    accent: "var(--teal)",
    iconName: "computer",
    name: {
      en: "Computer Science Group",
      ta: "கணினி அறிவியல் பிரிவு",
      hi: "कंप्यूटर साइंस ग्रुप",
    },
    description: {
      en: "Computer Science, Mathematics, Physics, Chemistry (+ Tamil & English)",
      ta: "கணினி அறிவியல், கணிதம், இயற்பியல், வேதியியல் (+ தமிழ், ஆங்கிலம்)",
      hi: "कंप्यूटर साइंस, गणित, भौतिकी, रसायन विज्ञान (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["CSC", "MAT", "PHY", "CHE"],
    allGroupCodes: ["CSC", "MAT", "PHY", "CHE", "TAM", "ENG"],
  },
  {
    id: "biology",
    code: "GROUP-2",
    badge: "Biology Group",
    accent: "var(--emerald, #10b981)",
    iconName: "science",
    name: {
      en: "Biology Group (Bio-Maths)",
      ta: "உயிரியல் பிரிவு (உயிரியல் & கணிதம்)",
      hi: "बायोलॉजी ग्रुप (बायो-मैथ्स)",
    },
    description: {
      en: "Biology, Mathematics, Physics, Chemistry (+ Tamil & English)",
      ta: "உயிரியல், கணிதம், இயற்பியல், வேதியியல் (+ தமிழ், ஆங்கிலம்)",
      hi: "जीव विज्ञान, गणित, भौतिकी, रसायन विज्ञान (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["BIO", "MAT", "PHY", "CHE"],
    allGroupCodes: ["BIO", "MAT", "PHY", "CHE", "TAM", "ENG"],
  },
  {
    id: "pure_science",
    code: "GROUP-3",
    badge: "Pure Science",
    accent: "var(--cyan, #06b6d4)",
    iconName: "science",
    name: {
      en: "Pure Science Group",
      ta: "தூய அறிவியல் பிரிவு",
      hi: "प्योर साइंस ग्रुप",
    },
    description: {
      en: "Physics, Chemistry, Botany, Zoology (+ Tamil & English)",
      ta: "இயற்பியல், வேதியியல், தாவரவியல், விலங்கியல் (+ தமிழ், ஆங்கிலம்)",
      hi: "भौतिकी, रसायन विज्ञान, वनस्पति विज्ञान, प्राणि विज्ञान (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["PHY", "CHE", "BOT", "ZOO"],
    allGroupCodes: ["PHY", "CHE", "BOT", "ZOO", "TAM", "ENG"],
  },
  {
    id: "commerce",
    code: "GROUP-4",
    badge: "Commerce Group",
    accent: "var(--amber)",
    iconName: "commerce",
    name: {
      en: "Commerce Group",
      ta: "வணிகவியல் பிரிவு",
      hi: "कॉमर्स ग्रुप",
    },
    description: {
      en: "Commerce, Accountancy, Economics, Computer Applications (+ Tamil & English)",
      ta: "வணிகவியல், கணக்குப்பதிவியல், பொருளியல், கணினி பயன்பாடுகள் (+ தமிழ், ஆங்கிலம்)",
      hi: "वाणिज्य, लेखा, अर्थशास्त्र, कंप्यूटर अनुप्रयोग (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["COM", "ACC", "ECO", "CAP"],
    allGroupCodes: ["COM", "ACC", "ECO", "CAP", "TAM", "ENG"],
  },
  {
    id: "commerce_ca",
    code: "GROUP-5",
    badge: "Commerce with CA",
    accent: "var(--amber)",
    iconName: "commerce",
    name: {
      en: "Commerce with Computer Applications",
      ta: "வணிகவியல் மற்றும் கணினி பயன்பாடுகள்",
      hi: "वाणिज्य और कंप्यूटर अनुप्रयोग",
    },
    description: {
      en: "Commerce, Accountancy, Economics, Computer Applications (+ Tamil & English)",
      ta: "வணிகவியல், கணக்குப்பதிவியல், பொருளியல், கணினி பயன்பாடுகள் (+ தமிழ், ஆங்கிலம்)",
      hi: "वाणिज्य, लेखा, अर्थशास्त्र, कंप्यूटर अनुप्रयोग (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["COM", "ACC", "ECO", "CAP"],
    allGroupCodes: ["COM", "ACC", "ECO", "CAP", "TAM", "ENG"],
  },
  {
    id: "business_maths",
    code: "GROUP-6",
    badge: "Business Maths",
    accent: "var(--violet)",
    iconName: "math",
    name: {
      en: "Business Maths Group",
      ta: "வணிகக் கணிதம் பிரிவு",
      hi: "बिजनेस मैथ्स ग्रुप",
    },
    description: {
      en: "Commerce, Accountancy, Economics, Business Mathematics (+ Tamil & English)",
      ta: "வணிகவியல், கணக்குப்பதிவியல், பொருளியல், வணிகக் கணிதம் (+ தமிழ், ஆங்கிலம்)",
      hi: "वाणिज्य, लेखा, अर्थशास्त्र, व्यावसायिक गणित (+ तमिल, अंग्रेजी)",
    },
    electiveCodes: ["COM", "ACC", "ECO", "BMA"],
    allGroupCodes: ["COM", "ACC", "ECO", "BMA", "TAM", "ENG"],
  },
];

export function getSeniorGroup(groupId?: string | null): SeniorGroupDefinition | undefined {
  if (!groupId) return undefined;
  if (groupId === "commerce_ca") {
    return SENIOR_GROUPS.find((g) => g.id === "commerce_ca") || SENIOR_GROUPS.find((g) => g.id === "commerce");
  }
  return SENIOR_GROUPS.find((g) => g.id === groupId);
}

export function filterSubjectsByGroup<S extends { readonly code: string }>(
  subjects: readonly S[],
  groupId?: string | null,
  includeLanguages = true,
): readonly S[] {
  if (!groupId || groupId === "all") return subjects;
  const group = getSeniorGroup(groupId);
  if (!group) return subjects;
  const targetCodes = includeLanguages ? group.allGroupCodes : group.electiveCodes;
  return subjects.filter((s) => {
    const prefix = s.code.split("-")[0] ?? "";
    return targetCodes.includes(prefix);
  });
}
export function getStandardsList(): readonly number[] {
  return SUPPORTED_STANDARDS;
}

export function validateStandardAccess(
  studentStandard: number,
  targetStandard: number,
): { allowed: boolean; reason?: string } {
  if (!isSupportedStandard(targetStandard)) {
    return { allowed: false, reason: `Standard ${targetStandard} is not currently supported.` };
  }
  if (studentStandard !== targetStandard) {
    return {
      allowed: false,
      reason: `This content belongs to Class ${targetStandard}, but your profile is currently set to Class ${studentStandard}.`,
    };
  }
  return { allowed: true };
}
