import { z } from 'zod';

/** Answer of `CONTACT_PAGE_PICKER_PROMPT`. */
export const contactPagePickerSchema = z.object({
  urls: z
    .array(z.string())
    .catch([]),
});
