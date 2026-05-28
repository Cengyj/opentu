import React from 'react';
import { FileImage, Layers3, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type { ReferenceImage } from '../shared';
import { PsdSourceImageField } from './PsdSourceImageField';
import type { PsdAnalysisStatus } from './PsdWorkbenchView';

interface PsdComposerPanelProps {
  uiLanguage: 'zh' | 'en';
  prompt: string;
  defaultPrompt: string;
  sourceImages: ReferenceImage[];
  plan: PsdGenerationPlan | null;
  analysisStatus?: PsdAnalysisStatus | null;
  isDisabled: boolean;
  primaryActionLabel: string;
  primaryActionEyebrow: string;
  canRunPrimaryAction: boolean;
  isPrimaryActionBusy: boolean;
  onPromptChange: (prompt: string) => void;
  onSourceImagesChange: (images: ReferenceImage[]) => void;
  onSourceImageError: (message: string | null) => void;
  onPrimaryAction: () => void;
  errorPanel?: React.ReactNode;
}

export function PsdComposerPanel({
  uiLanguage,
  prompt,
  defaultPrompt,
  sourceImages,
  plan,
  analysisStatus,
  isDisabled,
  primaryActionLabel,
  primaryActionEyebrow,
  canRunPrimaryAction,
  isPrimaryActionBusy,
  onPromptChange,
  onSourceImagesChange,
  onSourceImageError,
  onPrimaryAction,
  errorPanel,
}: PsdComposerPanelProps) {
  const hasSource = sourceImages.length > 0;
  const layerCount = plan?.layers.length || 0;
  const readyLabel = plan
    ? uiLanguage === 'zh'
      ? `${layerCount} 个图层待审阅`
      : `${layerCount} layers ready for review`
    : analysisStatus
    ? analysisStatus.title
    : uiLanguage === 'zh'
    ? '等待分析简报'
    : 'Waiting for layer brief';

  return (
    <aside
      className="psd-workbench__composer-panel"
      aria-label={uiLanguage === 'zh' ? 'PSD 源图与图层任务简报' : 'PSD source and layer task brief'}
    >
      <div className="psd-composer-identity">
        <span className="psd-setup-badge">
          <Layers3 size={14} />
          {uiLanguage === 'zh' ? 'PSD 生产台' : 'PSD Production Desk'}
        </span>
        <h2>{uiLanguage === 'zh' ? '图层任务简报' : 'Layer Task Brief'}</h2>
        <p>
          {uiLanguage === 'zh'
            ? '在同一个工作区完成源图、拆层目标、图层审阅、同画布素材生成与 PSD-ready 打包。'
            : 'Keep source, extraction goals, layer review, same-canvas asset generation, and PSD-ready packaging in one workspace.'}
        </p>
      </div>

      <div className="psd-readiness-board" aria-label={uiLanguage === 'zh' ? 'PSD 准备状态' : 'PSD readiness status'}>
        <div className="psd-readiness-board__item">
          <span className={`psd-badge-dot ${hasSource ? 'psd-badge-dot--ready' : 'psd-badge-dot--waiting'}`} />
          <strong>{uiLanguage === 'zh' ? '源图' : 'Source'}</strong>
          <small>{hasSource ? sourceImages[0]?.name || (uiLanguage === 'zh' ? '已载入' : 'Loaded') : uiLanguage === 'zh' ? '需要 1 张参考图' : 'One reference required'}</small>
        </div>
        <div className="psd-readiness-board__item">
          <span className={`psd-badge-dot ${plan ? 'psd-badge-dot--ready' : analysisStatus ? 'psd-badge-dot--waiting' : 'psd-badge-dot--idle'}`} />
          <strong>{uiLanguage === 'zh' ? '计划' : 'Plan'}</strong>
          <small>{readyLabel}</small>
        </div>
      </div>

      {analysisStatus ? (
        <div className={`psd-analysis-result-card psd-analysis-result-card--${analysisStatus.state}`} role="status">
          <strong>{analysisStatus.title}</strong>
          <div>{analysisStatus.detail}</div>
        </div>
      ) : null}

      <section className="psd-composer-card psd-composer-card--source">
        <div className="psd-composer-card__head">
          <span><FileImage size={13} /> {uiLanguage === 'zh' ? '源图' : 'Source image'}</span>
          <strong>{uiLanguage === 'zh' ? '原始海报 / 参考图' : 'Original poster / reference'}</strong>
        </div>
        <PsdSourceImageField
          uiLanguage={uiLanguage}
          images={sourceImages}
          disabled={isDisabled}
          onImagesChange={onSourceImagesChange}
          onError={onSourceImageError}
        />
      </section>

      <section className="psd-composer-card psd-composer-card--brief">
        <div className="psd-composer-card__head">
          <span><ShieldCheck size={13} /> {uiLanguage === 'zh' ? '拆层目标' : 'Extraction objective'}</span>
          <strong>{uiLanguage === 'zh' ? '约束、互斥元素与可编辑文字策略' : 'Constraints, exclusions, and editable text policy'}</strong>
        </div>
        <textarea
          className="psd-composer-brief"
          aria-label={uiLanguage === 'zh' ? 'PSD 图层提取简报' : 'PSD layer extraction brief'}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={defaultPrompt}
          disabled={isDisabled}
        />
      </section>

      <section className="psd-composer-action">
        <span>{primaryActionEyebrow}</span>
        <button
          type="button"
          className="psd-composer-primary"
          disabled={!canRunPrimaryAction || isPrimaryActionBusy}
          onClick={onPrimaryAction}
        >
          {isPrimaryActionBusy ? <RefreshCw size={15} /> : <Play size={15} />}
          {primaryActionLabel}
        </button>
        <p>
          {uiLanguage === 'zh'
            ? '边界：首个动作只创建 CHAT 分析任务；你审阅并编辑图层计划后，才创建 IMAGE 图层素材任务。导出始终是 .psd-ready-workspace.zip。'
            : 'Boundary: the first action creates only a CHAT analysis task. IMAGE layer tasks start only after your review. Export always remains .psd-ready-workspace.zip.'}
        </p>
      </section>

      {errorPanel ? <div className="psd-setup-error">{errorPanel}</div> : null}
    </aside>
  );
}
