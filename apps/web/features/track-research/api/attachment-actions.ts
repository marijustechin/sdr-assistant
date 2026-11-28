'use server';

import { revalidatePath } from 'next/cache';

import {
  removeResearchAttachment,
  uploadResearchAttachment,
  type ResearchAttachment,
} from '@/entities/research';

export type UploadResearchAttachmentResult =
  | { readonly ok: true; readonly attachment: ResearchAttachment }
  | { readonly ok: false; readonly message: string };

export type RemoveResearchAttachmentResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Uploads one research-owned attachment.
 *
 * The file is validated by the browser for immediate feedback and again by the
 * API, which is authoritative. Only metadata returns to the client; the stored
 * bytes never leave the server. No email is sent.
 */
export async function uploadResearchAttachmentAction(
  researchId: string,
  formData: FormData,
): Promise<UploadResearchAttachmentResult> {
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return { ok: false, message: 'Choose a file to upload.' };
  }

  if (file.size === 0) {
    return { ok: false, message: 'The selected file is empty.' };
  }

  const result = await uploadResearchAttachment(researchId, {
    filename: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath(`/researches/${researchId}`);

  return { ok: true, attachment: result.data };
}

/** Removes one research-owned attachment. The file bytes are deleted with it. */
export async function removeResearchAttachmentAction(
  researchId: string,
  attachmentId: string,
): Promise<RemoveResearchAttachmentResult> {
  const result = await removeResearchAttachment(researchId, attachmentId);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath(`/researches/${researchId}`);

  return { ok: true };
}
