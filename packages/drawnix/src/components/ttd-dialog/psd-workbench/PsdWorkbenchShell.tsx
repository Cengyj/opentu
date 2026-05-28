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
  const labels =
    uiLanguage === 'zh'
      ? {
          brief: '01 简报 / 源图',
          canvas: '02 主画布工作台',
          plan: '03 图层 / 状态 / 导出',
        }
      : {
          brief: '01 Brief / source',
          canvas: '02 Dominant canvas',
          plan: '03 Layers / status / export',
        };

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
          <div className="psd-workbench__rail-marker" aria-hidden="true">
            {labels.brief}
          </div>
          {brief}
        </section>

        <section
          className="psd-workbench__region psd-workbench__region--canvas psd-workbench__center-stage"
          aria-label={
            uiLanguage === 'zh' ? 'PSD 连续画布' : 'PSD continuous canvas'
          }
        >
          <div className="psd-workbench__rail-marker psd-workbench__rail-marker--canvas" aria-hidden="true">
            {labels.canvas}
          </div>
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
          <div className="psd-workbench__rail-marker" aria-hidden="true">
            {labels.plan}
          </div>
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
