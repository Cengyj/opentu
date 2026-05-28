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
 * The desktop surface is intentionally a three-column production desk:
 * source/task controls on the left, the dominant canvas in the center, and
 * layer plan plus status/export operations on the right. PSD business flow
 * stays in the child hooks/components; this shell owns only spatial regions.
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
        <section
          className="psd-workbench__region psd-workbench__region--brief psd-workbench__left-rail"
          aria-label={
            uiLanguage === 'zh' ? 'PSD 分层任务简报' : 'PSD layer task brief'
          }
        >
          {brief}
        </section>

        <section
          className="psd-workbench__region psd-workbench__region--canvas psd-workbench__center-stage"
          aria-label={
            uiLanguage === 'zh' ? 'PSD 连续画布' : 'PSD continuous canvas'
          }
        >
          {canvas}
        </section>

        <aside
          className="psd-workbench__region psd-workbench__region--plan psd-workbench__right-rail"
          aria-label={
            uiLanguage === 'zh'
              ? 'PSD 图层计划、状态与导出'
              : 'PSD layer plan, status, and export'
          }
        >
          <section
            className="psd-workbench__plan-column"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 图层计划' : 'PSD layer plan'
            }
          >
            {plan}
          </section>

          {operations}
        </aside>
      </div>
    </div>
  );
}
