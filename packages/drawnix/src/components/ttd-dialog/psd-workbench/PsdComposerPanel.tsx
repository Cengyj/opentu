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
  autoGenerateAfterAnalysis?: boolean;
  onAutoGenerateAfterAnalysisChange?: (enabled: boolean) => void;
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
  autoGenerateAfterAnalysis = false,
  onAutoGenerateAfterAnalysisChange,
  onPromptChange,
  onSourceImagesChange,
  onSourceImageError,
  onPrimaryAction,
  errorPanel,
}: PsdComposerPanelProps) {
  const hasSource = sourceImages.length > 0;
  const showAutoGenerateToggle =
    !plan && Boolean(onAutoGenerateAfterAnalysisChange);
  const layerCount = plan?.layers.length || 0;
  const readyLabel = plan
    ? uiLanguage === 'zh'
      ? `${layerCount} 个图层待审阅`
      : `${layerCount} layers ready for review`
    : analysisStatus
    ? uiLanguage === 'zh'
      ? '分析中'
      : 'Analyzing'
    : uiLanguage === 'zh'
    ? '等待分析简报'
    : 'Waiting for layer brief';

  return (
    <aside
      className="psd-workbench__composer-panel"
      aria-label={
        uiLanguage === 'zh'
          ? 'PSD 源图与图层任务简报'
          : 'PSD source and layer task brief'
      }
    >
      <div className="psd-composer-identity">
        <span className="psd-setup-badge">
          <Layers3 size={14} />
          {uiLanguage === 'zh' ? 'PSD Brief Desk' : 'PSD Brief Desk'}
        </span>
        <h2>{uiLanguage === 'zh' ? 'PSD 分层任务简报' : 'PSD Layer Brief'}</h2>
        <p>
          {uiLanguage === 'zh'
            ? '像制作任务单一样管理源图、拆层目标、约束和主操作；所有后续状态都在右侧工作台原地演进。'
            : 'Manage source, extraction goals, constraints, and the main action as a production brief; downstream states evolve in-place.'}
        </p>
      </div>

      <div
        className="psd-readiness-board"
        aria-label={
          uiLanguage === 'zh' ? 'PSD 准备状态' : 'PSD readiness status'
        }
      >
        <div className="psd-readiness-board__item">
          <span
            className={`psd-badge-dot ${
              hasSource ? 'psd-badge-dot--ready' : 'psd-badge-dot--waiting'
            }`}
          />
          <strong>{uiLanguage === 'zh' ? '源图' : 'Source'}</strong>
          <small>
            {hasSource
              ? sourceImages[0]?.name ||
                (uiLanguage === 'zh' ? '已载入' : 'Loaded')
              : uiLanguage === 'zh'
              ? '需要 1 张参考图'
              : 'One reference required'}
          </small>
        </div>
        <div className="psd-readiness-board__item">
          <span
            className={`psd-badge-dot ${
              plan
                ? 'psd-badge-dot--ready'
                : analysisStatus
                ? 'psd-badge-dot--waiting'
                : 'psd-badge-dot--idle'
            }`}
          />
          <strong>{uiLanguage === 'zh' ? '计划' : 'Plan'}</strong>
          <small>{readyLabel}</small>
        </div>
      </div>

      <section className="psd-composer-card psd-composer-card--source">
        <div className="psd-composer-card__head">
          <span>
            <FileImage size={13} />{' '}
            {uiLanguage === 'zh' ? '源图' : 'Source image'}
          </span>
          <strong>
            {uiLanguage === 'zh'
              ? '原始海报 / 参考图'
              : 'Original poster / reference'}
          </strong>
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
          <span>
            <ShieldCheck size={13} />{' '}
            {uiLanguage === 'zh' ? '拆层目标' : 'Extraction objective'}
          </span>
          {prompt !== defaultPrompt ? (
            <button
              type="button"
              className="psd-composer-quick-fill"
              onClick={() => onPromptChange(defaultPrompt)}
              disabled={isDisabled}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--psd-accent)',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 850,
                padding: '0 4px',
                textDecoration: 'underline',
              }}
            >
              {uiLanguage === 'zh' ? '填入默认' : 'Use Default'}
            </button>
          ) : (
            <strong>
              {uiLanguage === 'zh'
                ? '约束与文字策略'
                : 'Constraints & text policy'}
            </strong>
          )}
        </div>
        <textarea
          className="psd-composer-brief"
          aria-label={
            uiLanguage === 'zh'
              ? 'PSD 图层提取简报'
              : 'PSD layer extraction brief'
          }
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={defaultPrompt}
          disabled={isDisabled}
        />
      </section>

      <section className="psd-composer-action">
        <div className="psd-composer-action__head">
          <span>{primaryActionEyebrow}</span>
          {showAutoGenerateToggle ? (
            <label className="psd-composer-auto">
              <input
                type="checkbox"
                checked={autoGenerateAfterAnalysis}
                disabled={isDisabled}
                onChange={(event) =>
                  onAutoGenerateAfterAnalysisChange?.(event.target.checked)
                }
              />
              <span>
                {uiLanguage === 'zh'
                  ? '分析后自动生成图层'
                  : 'Auto-generate after analysis'}
              </span>
            </label>
          ) : null}
        </div>
        <button
          type="button"
          className={`psd-composer-primary${isPrimaryActionBusy ? ' psd-composer-primary--busy' : ''}`}
          disabled={!canRunPrimaryAction || isPrimaryActionBusy}
          aria-busy={isPrimaryActionBusy}
          onClick={onPrimaryAction}
          aria-disabled={!canRunPrimaryAction || isPrimaryActionBusy}
        >
          {isPrimaryActionBusy ? <RefreshCw size={15} /> : <Play size={15} />}
          {primaryActionLabel}
        </button>
      </section>

      {errorPanel ? <div className="psd-setup-error">{errorPanel}</div> : null}
    </aside>
  );
}
