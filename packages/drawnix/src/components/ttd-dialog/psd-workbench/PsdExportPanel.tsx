import React from 'react';
import { Download, PackageCheck, RefreshCw } from 'lucide-react';
import { getExportMessage } from '../ai-psd-workflow-view-utils';

interface PsdExportPanelProps {
  uiLanguage: 'zh' | 'en';
  resultCount: number;
  canDownload: boolean;
  isDownloading: boolean;
  onDownload: () => void;
}

export function PsdExportPanel({
  uiLanguage,
  resultCount,
  canDownload,
  isDownloading,
  onDownload,
}: PsdExportPanelProps) {
  const exportState = isDownloading
    ? 'busy'
    : canDownload
    ? 'ready'
    : resultCount > 0
    ? 'partial'
    : 'waiting';
  const stateLabel =
    exportState === 'busy'
      ? uiLanguage === 'zh'
        ? '正在打包'
        : 'Packaging'
      : exportState === 'ready'
      ? uiLanguage === 'zh'
        ? '可下载'
        : 'Ready'
      : exportState === 'partial'
      ? uiLanguage === 'zh'
        ? '部分结果'
        : 'Partial results'
      : uiLanguage === 'zh'
      ? '等待结果'
      : 'Waiting';

  return (
    <section
      className={`psd-export-card psd-export-card--${exportState}`}
      aria-label={
        uiLanguage === 'zh' ? 'PSD-ready 导出面板' : 'PSD-ready export panel'
      }
    >
      <div className="psd-export-card__head">
        <span className="psd-export-card__eyebrow">
          <PackageCheck size={13} /> {uiLanguage === 'zh' ? '导出' : 'Export'}
        </span>
        <h3>
          {uiLanguage === 'zh'
            ? '下载 PSD-ready 工作区'
            : 'Download PSD-ready workspace'}
        </h3>
      </div>
      <div className="psd-export-card__state" aria-live="polite">
        <strong>{stateLabel}</strong>
        <span>
          {uiLanguage === 'zh'
            ? `${resultCount} 个可打包结果 · .psd-ready-workspace.zip`
            : `${resultCount} packageable results · .psd-ready-workspace.zip`}
        </span>
      </div>
      <p>{getExportMessage(canDownload, uiLanguage)}</p>
      <div className="psd-export-card__assets">
        <span>
          {uiLanguage === 'zh' ? '同画布 PNG 图层' : 'Same-canvas PNG layers'}
        </span>
        <span>{uiLanguage === 'zh' ? '源图' : 'Source'}</span>
        <span>manifest.json</span>
        <span>README</span>
      </div>
      <button
        type="button"
        className={`psd-export-card__button${
          isDownloading ? ' psd-export-card__button--busy' : ''
        }`}
        disabled={!canDownload || isDownloading}
        aria-disabled={!canDownload || isDownloading}
        aria-busy={isDownloading}
        onClick={onDownload}
      >
        {isDownloading ? <RefreshCw size={16} /> : <Download size={16} />}
        <span>
          {isDownloading
            ? uiLanguage === 'zh'
              ? '正在下载 PSD-ready 工作区包'
              : 'Downloading PSD-ready package'
            : uiLanguage === 'zh'
            ? '下载 PSD-ready 工作区包'
            : 'Download PSD-ready package'}
        </span>
      </button>
      <dl>
        <div>
          <dt>{uiLanguage === 'zh' ? '可打包结果' : 'Packageable results'}</dt>
          <dd>{resultCount}</dd>
        </div>
        <div>
          <dt>{uiLanguage === 'zh' ? '文件格式' : 'File format'}</dt>
          <dd>.psd-ready-workspace.zip</dd>
        </div>
        <div>
          <dt>{uiLanguage === 'zh' ? '原生 PSD' : 'Native PSD'}</dt>
          <dd>{uiLanguage === 'zh' ? '未宣称' : 'Not claimed'}</dd>
        </div>
      </dl>
    </section>
  );
}
