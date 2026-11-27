'use server';

import { revalidatePath } from 'next/cache';

import { updateResearchEmailAccount } from '@/entities/research';

export type ResearchEmailAccountActionResult =
  | { readonly ok: true; readonly emailAccountId: string | null }
  | { readonly ok: false; readonly message: string };

/**
 * Assigns, changes or removes the research email account.
 *
 * The API validates the research, the account and its enabled state; this
 * action only forwards the selection and returns a typed failure the tab can
 * display. No credential is part of the request or the response.
 */
export async function updateResearchEmailAccountAction(
  researchId: string,
  emailAccountId: string | null,
): Promise<ResearchEmailAccountActionResult> {
  const result = await updateResearchEmailAccount(researchId, emailAccountId);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath(`/researches/${researchId}`);

  return { ok: true, emailAccountId: result.data.emailAccountId };
}
