import 'server-only';

import { deleteJson, getJson, postBytes } from '@/shared/api/http';
import type { ApiResult } from '@/shared/api/http';
import { apiUrl } from '@/shared/config/env';

import {
  removeResearchAttachmentResultSchema,
  researchAttachmentListSchema,
  researchAttachmentSchema,
  type RemoveResearchAttachmentResult,
  type ResearchAttachment,
  type ResearchAttachmentList,
  type ResearchAttachmentUpload,
} from '../model/attachments';

export function fetchResearchAttachments(
  jobId: string,
): Promise<ApiResult<ResearchAttachmentList>> {
  return getJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/attachments`,
    researchAttachmentListSchema,
  );
}

/**
 * Uploads one attachment as a raw binary body. The file name and media type
 * travel in percent-encoded headers because the body is the file itself; the
 * API revalidates both and returns metadata only.
 */
export function uploadResearchAttachment(
  jobId: string,
  upload: ResearchAttachmentUpload,
): Promise<ApiResult<ResearchAttachment>> {
  return postBytes(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/attachments`,
    upload.bytes,
    researchAttachmentSchema,
    {
      timeoutMs: 60_000,
      headers: {
        'content-type': 'application/octet-stream',
        'x-attachment-filename': encodeURIComponent(upload.filename),
        'x-attachment-mime-type': encodeURIComponent(upload.mimeType),
      },
    },
  );
}

export function removeResearchAttachment(
  jobId: string,
  attachmentId: string,
): Promise<ApiResult<RemoveResearchAttachmentResult>> {
  return deleteJson(
    `${apiUrl}/research/${encodeURIComponent(jobId)}/communication/attachments/${encodeURIComponent(attachmentId)}`,
    removeResearchAttachmentResultSchema,
  );
}
