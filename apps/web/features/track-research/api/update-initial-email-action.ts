'use server';

import { revalidatePath } from 'next/cache';

import {
  updateResearchInitialEmail,
  type ResearchInitialEmail,
} from '@/entities/research';

export type ResearchInitialEmailResult =
  | { readonly ok: true; readonly initialEmail: ResearchInitialEmail }
  | { readonly ok: false; readonly message: string };

/**
 * Saves the owner-authored plain-text initial email.
 *
 * The API validates the research and both fields; this action forwards the
 * values and returns a typed failure the Settings tab can display. No email is
 * sent and no mailbox is touched.
 */
export async function updateResearchInitialEmailAction(
  researchId: string,
  subject: string,
  body: string,
): Promise<ResearchInitialEmailResult> {
  const result = await updateResearchInitialEmail(researchId, subject, body);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath(`/researches/${researchId}`);

  return { ok: true, initialEmail: result.data };
}
