import type { Metadata } from 'next';

import { SettingsPage } from '@/_pages/settings';

export const metadata: Metadata = {
  title: 'Settings | SDR Assistant',
};

export default function Page() {
  return <SettingsPage />;
}
