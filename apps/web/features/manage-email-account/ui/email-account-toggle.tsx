'use client';

import { useTransition } from 'react';

import type { EmailAccount } from '@/entities/email-account/client';
import { toast } from '@/shared/lib/toast';

import { setEmailAccountEnabled } from '../api/action';

type EmailAccountToggleProps = {
  readonly account: EmailAccount;
};

/**
 * Enable/disable from the account list. The server action writes only the
 * status and revalidates the list, so the row re-renders with the new state.
 */
export function EmailAccountToggle({ account }: EmailAccountToggleProps) {
  const [pending, startTransition] = useTransition();

  function handleClick(): void {
    startTransition(async () => {
      const result = await setEmailAccountEnabled(account.id, !account.enabled);

      if (!result.ok) {
        toast.error('Could not update the email account', {
          description: result.message,
        });
        return;
      }

      toast.success(
        account.enabled ? 'Email account disabled' : 'Email account enabled',
      );
    });
  }

  return (
    <button
      type="button"
      className="button small secondary"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Saving…' : account.enabled ? 'Disable' : 'Enable'}
    </button>
  );
}
