'use client';

import {
  fetchResearchStatus,
  type ResearchResponse,
} from '@/entities/research';
import { useEffect, useState } from 'react';

type ResearchProgressProps = {
  initialResearch: ResearchResponse;
};

export const ResearchProgres = ({ initialResearch }: ResearchProgressProps) => {
  const frames = ['|', '/', '—', '\\'];
  const [research, setResearch] = useState(initialResearch);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (
      initialResearch.status !== 'QUEUED' &&
      initialResearch.status !== 'RUNNING'
    ) {
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      let keepPolling = true;

      try {
        const updated = await fetchResearchStatus(
          initialResearch.id,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setResearch(updated);
        setFrameIndex((index) => (index + 1) % frames.length);

        keepPolling =
          updated.status === 'QUEUED' || updated.status === 'RUNNING';
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error('Could not refresh research status:', error);
      }

      if (!controller.signal.aborted && keepPolling) {
        timer = setTimeout(poll, 2000);
      }
    }

    void poll();

    return () => {
      controller.abort();

      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [initialResearch.id, initialResearch.status]);

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex gap-2'>
        <span
          aria-hidden='true'
          style={{
            display: 'inline-block',
            width: '1ch',
            fontFamily: 'monospace',
            textAlign: 'center',
          }}
        >
          {frames[frameIndex]}
        </span>

        <div>Status: {research.status}</div>
        <div>{research.stage}</div>
      </div>
    </div>
  );
};
