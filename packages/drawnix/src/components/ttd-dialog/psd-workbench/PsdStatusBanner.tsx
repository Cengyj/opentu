import React from 'react';

interface PsdStatusBannerProps {
  tone: 'queued' | 'active' | 'success' | 'warning' | 'error';
  title: string;
  countSummary: string;
  detail: string;
  progressPercent: number;
  progressLabel: string;
}

export function PsdStatusBanner({
  tone,
  title,
  countSummary,
  detail,
  progressPercent,
  progressLabel,
}: PsdStatusBannerProps) {
  return (
    <section
      className={`psd-generation-status psd-generation-status--${tone}`}
      role="status"
    >
      <strong>{title}</strong>
      <span className="psd-generation-status__counts">{countSummary}</span>
      <span>{detail}</span>
      <div
        className="psd-generation-status__progress"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        role="progressbar"
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </section>
  );
}
