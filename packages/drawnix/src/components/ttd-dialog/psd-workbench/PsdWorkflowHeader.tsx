import React from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  Layers3,
  PackageCheck,
  WandSparkles,
} from 'lucide-react';
import type { PsdAnalysisStatus } from './psd-workbench-types';

interface PsdWorkflowHeaderProps {
  uiLanguage: 'zh' | 'en';
  hasSource: boolean;
  hasLayerPlan: boolean;
  isLayerPlanReviewed: boolean;
  analysisStatus?: PsdAnalysisStatus | null;
  resultCount: number;
  canDownload: boolean;
}

type PsdStepState = 'done' | 'active' | 'waiting';

interface PsdWorkflowStep {
  id: string;
  label: string;
  detail: string;
  state: PsdStepState;
  icon: React.ReactNode;
}

function getStepState(done: boolean, active: boolean): PsdStepState {
  if (done) return 'done';
  if (active) return 'active';
  return 'waiting';
}

export function PsdWorkflowHeader({
  uiLanguage,
  hasSource,
  hasLayerPlan,
  isLayerPlanReviewed,
  analysisStatus,
  resultCount,
  canDownload,
}: PsdWorkflowHeaderProps) {
  const isAnalyzing = Boolean(
    analysisStatus && analysisStatus.state !== 'completed' && !hasLayerPlan
  );
  const hasResults = resultCount > 0;

  const steps: PsdWorkflowStep[] = [
    {
      id: 'source',
      label: uiLanguage === 'zh' ? '源图' : 'Source',
      detail: uiLanguage === 'zh' ? '上传参考图' : 'Upload reference',
      state: getStepState(hasSource, !hasSource),
      icon: <FileImage size={15} />,
    },
    {
      id: 'analysis',
      label: uiLanguage === 'zh' ? '分析' : 'Analyze',
      detail: uiLanguage === 'zh' ? 'CHAT 结构解析' : 'CHAT structure pass',
      state: getStepState(hasLayerPlan, hasSource && !hasLayerPlan),
      icon: <WandSparkles size={15} />,
    },
    {
      id: 'review',
      label: uiLanguage === 'zh' ? '审阅' : 'Review',
      detail: uiLanguage === 'zh' ? '编辑图层计划' : 'Edit the layer plan',
      state: getStepState(
        isLayerPlanReviewed,
        hasLayerPlan && !isLayerPlanReviewed
      ),
      icon: <ClipboardCheck size={15} />,
    },
    {
      id: 'layers',
      label: uiLanguage === 'zh' ? '素材' : 'Assets',
      detail: uiLanguage === 'zh' ? 'IMAGE 图层任务' : 'IMAGE layer tasks',
      state: getStepState(hasResults, isLayerPlanReviewed && !hasResults),
      icon: <Layers3 size={15} />,
    },
    {
      id: 'export',
      label: uiLanguage === 'zh' ? '导出' : 'Export',
      detail: '.psd-ready-workspace.zip',
      state: getStepState(canDownload, hasResults && !canDownload),
      icon: <PackageCheck size={15} />,
    },
  ];

  return (
    <header className="psd-workbench__header">
      <div className="psd-workbench__headline">
        <span className="psd-workbench__kicker">
          <Layers3 size={15} />
          {uiLanguage === 'zh'
            ? 'AI 图片窗口内的 PSD 工作台'
            : 'PSD workbench inside AI image'}
        </span>
        <div>
          <h2>
            {uiLanguage === 'zh'
              ? '源图、画布、图层计划与导出保持在同一业务流'
              : 'Source, canvas, layer plan, and export stay in one workflow'}
          </h2>
          <p>
            {uiLanguage === 'zh'
              ? '先分析，再审阅，最后生成同画布图层素材；不新增 PSD 任务/素材类型，也不宣称原生 PSD。'
              : 'Analyze first, review next, then generate same-canvas layer assets; no PSD task/asset types or native PSD claims.'}
          </p>
        </div>
      </div>

      <ol
        className="psd-workbench__step-rail"
        aria-label={
          uiLanguage === 'zh' ? 'PSD 工作流阶段' : 'PSD workflow stages'
        }
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`psd-workbench__step psd-workbench__step--${step.state}`}
          >
            <span className="psd-workbench__step-icon">
              {step.state === 'done' ? <CheckCircle2 size={15} /> : step.icon}
            </span>
            <span className="psd-workbench__step-copy">
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
            {index < steps.length - 1 ? (
              <span className="psd-workbench__step-line" />
            ) : null}
          </li>
        ))}
      </ol>

      {isAnalyzing ? (
        <div className="psd-workbench__live-status" role="status">
          <strong>{analysisStatus?.title}</strong>
          <span>{analysisStatus?.detail}</span>
        </div>
      ) : null}
    </header>
  );
}
