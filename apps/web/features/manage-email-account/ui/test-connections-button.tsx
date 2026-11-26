'use client';

import { useTransition } from 'react';

import { testAllEmailAccountConnectionsAction } from '../api/action';
import { notifyConnectionTestSummary } from '../model/connection-test-feedback';

type EmailAccountTestConnectionsButtonProps = {
  readonly accountId: string;
  readonly enabled: boolean;
};

/**
 * Combined connection test from the account list. The two protocol tests run
 * independently; while the action is pending the button is disabled, so a
 * duplicate request cannot be started from the UI.
 */
export function EmailAccountTestConnectionsButton({
  accountId,
  enabled,
}: EmailAccountTestConnectionsButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick(): void {
    startTransition(async () => {
      const summary = await testAllEmailAccountConnectionsAction(accountId);

      notifyConnectionTestSummary(summary);
    });
  }

  return (
    <button
      type="button"
      className="button small secondary"
      onClick={handleClick}
      disabled={!enabled || pending}
      aria-busy={pending}
      title={enabled ? undefined : 'Disabled accounts cannot be tested.'}
    >
      {pending ? 'Testing…' : 'Test connections'}
    </button>
  );
}
