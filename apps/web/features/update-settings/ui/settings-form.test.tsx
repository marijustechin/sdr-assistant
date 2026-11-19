// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SettingsGroup } from '@/entities/settings/client';
import { toast } from '@/shared/lib/toast';

const { saveSettings } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
}));

vi.mock('../api/action', () => ({ saveSettings }));

import { SettingsForm } from './settings-form';

const GROUP: SettingsGroup = {
  key: 'research.pageCollection',
  label: 'Page collection',
  description: 'Search and triage behaviour of stage 02.',
  items: [
    {
      key: 'research.pageCollection.resultsPerQuery',
      label: 'Results per query',
      description: 'How many search results stage 02 requests per provider.',
      type: 'integer',
      value: 20,
      default: 20,
      min: 1,
      max: 50,
    },
  ],
};

afterEach(() => {
  cleanup();
  saveSettings.mockReset();
  toast.clear();
});

describe('SettingsForm', () => {
  it('renders the field and its bounds from the API metadata', () => {
    render(<SettingsForm groups={[GROUP]} />);

    expect(
      screen.getByLabelText<HTMLInputElement>('Results per query').value,
    ).toBe('20');
    expect(screen.getByText(/Default 20/)).toBeTruthy();
    expect(screen.getByText(/Allowed 1–50/)).toBeTruthy();
  });

  it('shows the client-side validation error and does not call the action', async () => {
    render(<SettingsForm groups={[GROUP]} />);

    const input = screen.getByLabelText<HTMLInputElement>('Results per query');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(
      await screen.findByText('Results per query must be at least 1.'),
    ).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
