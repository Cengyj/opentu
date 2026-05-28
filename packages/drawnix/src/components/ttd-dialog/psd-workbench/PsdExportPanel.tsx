import React from 'react';
import { Download, PackageCheck } from 'lucide-react';
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
  return (
    <section className="psd-export-card" aria-label={uiLanguage === 'zh' ? 'PSD-ready 导出面板' : 'PSD-ready export panel'}>
      <div className="psd-export-card__head">
        <span className="psd-export-card__eyebrow"><PackageCheck size={13} /> {uiLanguage === 'zh' ? '导出' : 'Export'}</span>
        <h3>{uiLanguage === 'zh' ? '下载 PSD-ready 工作区' : 'Download PSD-ready workspace'}</h3>
      </div>
      <p>{getExportMessage(canDownload, uiLanguage)}</p>
      <div className="psd-export-card__assets">
        <span>{uiLanguage === 'zh' ? '同画布 PNG 图层' : 'Same-canvas PNG layers'}</span>
        <span>{uiLanguage === 'zh' ? '源图' : 'Source'}</span>
        <span>manifest.json</span>
        <span>README</span>
      </div>
      <button type="button" className="psd-export-card__button" disabled={!canDownload || isDownloading} onClick={onDownload}>
        <Download size={16} />
        <span>{uiLanguage === 'zh' ? '下载 PSD-ready 工作区包' : 'Download PSD-ready package'}</span>
      </button>
      <dl>
        <div><dt>{uiLanguage === 'zh' ? '可打包结果' : 'Packageable results'}</dt><dd>{resultCount}</dd></div>
        <div><dt>{uiLanguage === 'zh' ? '文件格式' : 'File format'}</dt><dd>.psd-ready-workspace.zip</dd></div>
        <div><dt>{uiLanguage === 'zh' ? '原生 PSD' : 'Native PSD'}</dt><dd>{uiLanguage === 'zh' ? '未宣称' : 'Not claimed'}</dd></div>
      </dl>
    </section>
  );
}
