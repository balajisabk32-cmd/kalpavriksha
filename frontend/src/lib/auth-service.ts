"use client";

import type { Profile } from "@/lib/progress";
import { updateProgress } from "@/components/progress-store";
import { makeStudentId, setProfile, updateStudentProfile } from "@/lib/progress";

/**
 * Device-side profile helpers. Accounts, sign-in and each student's class live
 * on the server (src/server/, /api/auth/me); `components/session-user.tsx` copies
 * the signed-in account onto the device. What's here only changes this device's
 * copy — e.g. the class a teacher is browsing.
 */
export const authService = {
  saveProfile(data: {
    name: string;
    email?: string;
    grade: number;
    avatar: Profile["avatar"];
    preferredLanguage?: Profile["preferredLanguage"];
    board?: string;
    seniorGroup?: string;
    studentId?: string;
  }): Profile {
    const profile: Profile = {
      name: data.name.trim().slice(0, 24),
      email: data.email?.trim().slice(0, 80),
      grade: data.grade,
      avatar: data.avatar,
      preferredLanguage: data.preferredLanguage,
      board: data.board || "tn_state",
      seniorGroup: data.grade >= 11 ? data.seniorGroup : undefined,
      studentId: data.studentId || makeStudentId(data.board, data.grade),
    };
    updateProgress((p) => setProfile(p, profile));
    return profile;
  },

  /** The class (and stream) shown on this device. For staff browsing classes; a student's class comes from the server. */
  updateStandard(grade: number, seniorGroup?: string): void {
    updateProgress((p) =>
      updateStudentProfile(p, {
        grade,
        ...(seniorGroup !== undefined ? { seniorGroup: grade >= 11 ? seniorGroup : undefined } : {}),
      }),
    );
  },
};
