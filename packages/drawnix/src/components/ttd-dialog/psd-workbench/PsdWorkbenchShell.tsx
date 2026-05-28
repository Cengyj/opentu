import React from 'react';

interface PsdWorkbenchShellProps {
  header: React.ReactNode;
  brief: React.ReactNode;
  canvas: React.ReactNode;
  plan: React.ReactNode;
  operations: React.ReactNode;
  uiLanguage: 'zh' | 'en';
}

/**
 * Stable PSD workbench skeleton.
 *
 * Regions stay explicit so future PSD additions (drag sorting, grouping,
 * packers, local repaint, property panels) can replace one slot without
 * changing task orchestration or relying on wrapper/CSS override patches.
 */
export function PsdWorkbenchShell({
  header,
  brief,
  canvas,
  plan,
  operations,
  uiLanguage,
}: PsdWorkbenchShellProps) {
  return (
    <div className="psd-workbench">
      <div className="psd-workbench__region psd-workbench__region--header">
        {header}
      </div>

      <div className="psd-workbench__workspace-grid">
        <div className="psd-workbench__main-column">
          <section
            className="psd-workbench__region psd-workbench__region--brief psd-workbench__brief-column"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 分层任务简报' : 'PSD layer task brief'
            }
          >
            {brief}
          </section>

          <section
            className="psd-workbench__region psd-workbench__region--canvas psd-workbench__canvas-column"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 连续画布' : 'PSD continuous canvas'
            }
          >
            {canvas}
          </section>
        </div>

        <div className="psd-workbench__side-column">
          <section
            className="psd-workbench__region psd-workbench__region--plan psd-workbench__plan-column"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 图层计划' : 'PSD layer plan'
            }
          >
            {plan}
          </section>

          {operations}
        </div>
      </div>
    </div>
  );
}
