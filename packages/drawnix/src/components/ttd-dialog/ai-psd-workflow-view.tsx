import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileImage,
  ImagePlus,
  Layers,
  LocateFixed,
  Maximize2,
  MousePointer2,
  Move,
  PanelRight,
  ScanSearch,
  SquareStack,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getLayerTypeLabel, type PsdGenerationPlan } from './ai-psd-plan';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clamp,
  getExportMessage,
  getLayerBounds,
  getLayerStatusLabel,
  type PsdTaskSummary,
} from './ai-psd-workflow-view-utils';
import type { ReferenceImage } from './shared';

interface PsdWorkflowViewProps {
  uiLanguage: 'zh' | 'en';
  inputPanel: React.ReactNode;
  plan: PsdGenerationPlan | null;
  analysisStatus?: PsdAnalysisStatus | null;
  status: PsdTaskSummary | null;
  sourceImages: ReferenceImage[];
  previewUrl?: string;
  layerPreviewUrls?: Record<string, string[]>;
  resultCount: number;
  canDownload: boolean;
  isDownloading?: boolean;
  onDownload: () => void;
  errorPanel?: React.ReactNode;
}

export interface PsdAnalysisStatus {
  state: 'queued' | 'processing' | 'completed' | 'failed';
  model: string;
  title: string;
  detail: string;
}

type PsdPreviewSelection =
  | { type: 'source' }
  | { type: 'composite' }
  | { type: 'layer'; layerId: string };

export function PsdWorkflowView({
  uiLanguage,
  inputPanel,
  plan,
  analysisStatus,
  status,
  sourceImages,
  previewUrl,
  layerPreviewUrls = {},
  resultCount,
  canDownload,
  isDownloading = false,
  onDownload,
  errorPanel,
}: PsdWorkflowViewProps) {
  const sourcePreviewUrl = sourceImages[0]?.url;
  const [previewSelection, setPreviewSelection] =
    useState<PsdPreviewSelection>({ type: 'source' });
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(
    () => new Set()
  );
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [stageViewportSize, setStageViewportSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [showSourceUnderlay, setShowSourceUnderlay] = useState(false);
  const [showLayerGuides, setShowLayerGuides] = useState(false);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const hasAutoSelectedResultRef = useRef(false);
  const dragStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  const layers = plan?.layers || [];
  const selectedLayerId =
    previewSelection.type === 'layer' ? previewSelection.layerId : null;
  const selectedLayer =
    layers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedLayerIndex = selectedLayer
    ? layers.findIndex((layer) => layer.id === selectedLayer.id)
    : -1;
  const selectedLayerBounds =
    selectedLayer && selectedLayerIndex >= 0
      ? getLayerBounds(selectedLayer, selectedLayerIndex)
      : null;
  const visibleLayers = useMemo(
    () => layers.filter((layer) => !hiddenLayerIds.has(layer.id)),
    [hiddenLayerIds, layers]
  );
  const layerStackItems = useMemo(
    () =>
      layers.map((layer) => ({
        layer,
        index: layers.findIndex((candidate) => candidate.id === layer.id),
        previewUrl: layerPreviewUrls[layer.id]?.[0],
        isHidden: hiddenLayerIds.has(layer.id),
      })),
    [hiddenLayerIds, layerPreviewUrls, layers]
  );
  const visibleStackItems = useMemo(
    () => layerStackItems.filter((item) => !item.isHidden),
    [layerStackItems]
  );

  const activeLayerId = selectedLayer?.id || null;
  const selectedLayerPreviewUrl = activeLayerId
    ? layerPreviewUrls[activeLayerId]?.[0]
    : undefined;
  const hasSource = sourceImages.length > 0;
  const hasResult = Boolean(previewUrl);
  const hasLayerResults = Object.values(layerPreviewUrls).some(
    (urls) => urls.length > 0
  );
  const analysisTone =
    analysisStatus?.state === 'completed'
      ? 'success'
      : analysisStatus?.state === 'failed'
      ? 'error'
      : analysisStatus
      ? 'active'
      : null;
  const isCompositeStackPreview =
    previewSelection.type === 'composite' && layers.length > 0;
  const generatedStackLayerCount = visibleStackItems.filter(
    (item) => item.previewUrl
  ).length;
  const hiddenLayerCount = hiddenLayerIds.size;
  const visibleLayerCount = visibleLayers.length;
  const isLayerPreview = previewSelection.type === 'layer' && !!selectedLayer;
  const shouldShowLayerGuides =
    !isLayerPreview &&
    visibleLayers.length > 0 &&
    (!hasLayerResults || showLayerGuides);
  const activePreviewUrl = isLayerPreview
    ? selectedLayerPreviewUrl
    : isCompositeStackPreview
    ? undefined
    : previewSelection.type === 'composite'
    ? previewUrl || sourcePreviewUrl
    : sourcePreviewUrl || previewUrl;
  const canvasAspectRatio = canvasSize
    ? `${canvasSize.width} / ${canvasSize.height}`
    : '1 / 1';
  const fittedArtboardSize = useMemo(() => {
    if (!canvasSize || !stageViewportSize) return null;
    const availableWidth = Math.max(stageViewportSize.width - 28, 160);
    const availableHeight = Math.max(stageViewportSize.height - 28, 160);
    const fitScale = Math.min(
      availableWidth / canvasSize.width,
      availableHeight / canvasSize.height
    );
    const fittedScale = Math.min(fitScale, 1);
    return {
      width: Math.max(Math.round(canvasSize.width * fittedScale), 1),
      height: Math.max(Math.round(canvasSize.height * fittedScale), 1),
    };
  }, [canvasSize, stageViewportSize]);
  const artboardStyle: React.CSSProperties = {
    aspectRatio: canvasAspectRatio,
    ...(fittedArtboardSize
      ? {
          width: `${fittedArtboardSize.width}px`,
          height: `${fittedArtboardSize.height}px`,
        }
      : {}),
  };
  const workbenchTone = status?.tone || analysisTone || (hasSource ? 'queued' : 'empty');
  const workbenchStateLabel =
    uiLanguage === 'zh'
      ? hasLayerResults || hasResult
        ? '结果就绪'
        : analysisStatus?.state === 'processing' ||
          analysisStatus?.state === 'queued'
        ? '分析中'
        : analysisStatus?.state === 'failed'
        ? '分析失败'
        : status?.isActive
        ? '生成中'
        : status?.tone === 'error'
        ? '需重试'
        : hasSource
        ? '已载入源图'
        : '等待源图'
      : hasResult
      ? 'Result ready'
      : hasLayerResults
      ? 'Result ready'
      : analysisStatus?.state === 'processing' ||
        analysisStatus?.state === 'queued'
      ? 'Analyzing'
      : analysisStatus?.state === 'failed'
      ? 'Analysis failed'
      : status?.isActive
      ? 'Generating'
      : status?.tone === 'error'
      ? 'Retry needed'
      : hasSource
      ? 'Source loaded'
      : 'Waiting for source';
  const previewHeading = isLayerPreview
    ? uiLanguage === 'zh'
      ? `查看图层：${selectedLayer?.name}`
      : `Viewing layer: ${selectedLayer?.name}`
    : previewSelection.type === 'composite'
    ? hasResult || hasLayerResults
      ? uiLanguage === 'zh'
        ? '分层结果叠放预览'
        : 'Layer stack preview'
      : layers.length > 0
      ? uiLanguage === 'zh'
        ? '计划图层叠放预览'
        : 'Planned layer stack'
      : uiLanguage === 'zh'
      ? '合成预览'
      : 'Composite preview'
    : sourcePreviewUrl
    ? uiLanguage === 'zh'
      ? '源图预览'
      : 'Source preview'
    : uiLanguage === 'zh'
    ? '空画布'
    : 'Empty canvas';
  const exportStateLabel = canDownload
    ? uiLanguage === 'zh'
      ? '可下载'
      : 'Download ready'
    : status?.isActive
    ? uiLanguage === 'zh'
      ? '等待生成'
      : 'Waiting'
    : uiLanguage === 'zh'
    ? '未就绪'
    : 'Not ready';

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setHiddenLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select')) {
        return;
      }
      dragStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStartRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPan({
        x: drag.panX + event.clientX - drag.x,
        y: drag.panY + event.clientY - drag.y,
      });
    },
    []
  );

  const stopDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
    }
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => clamp(current - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((current) => clamp(current + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const resetView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  const selectSourcePreview = useCallback(() => {
    fitView();
    setPreviewSelection({ type: 'source' });
  }, [fitView]);

  const selectCompositePreview = useCallback(() => {
    fitView();
    setPreviewSelection({ type: 'composite' });
  }, [fitView]);

  const selectLayerPreview = useCallback((layerId: string) => {
    fitView();
    setPreviewSelection({ type: 'layer', layerId });
  }, [fitView]);

  const handleCanvasImageLoad = useCallback(
    (
      event: React.SyntheticEvent<HTMLImageElement>,
      options: { force?: boolean } = {}
    ) => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setCanvasSize((current) =>
          options.force || !current
            ? { width: naturalWidth, height: naturalHeight }
            : current
        );
      }
    },
    []
  );

  useEffect(() => {
    const node = stageContentRef.current;
    if (!node) return undefined;

    const updateStageSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageViewportSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateStageSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateStageSize);
      return () => window.removeEventListener('resize', updateStageSize);
    }

    const resizeObserver = new ResizeObserver(updateStageSize);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!isCompositeStackPreview) {
      setShowSourceUnderlay(false);
    }
  }, [isCompositeStackPreview]);

  useEffect(() => {
    if (hasLayerResults) {
      setShowLayerGuides(false);
    }
  }, [hasLayerResults]);

  useEffect(() => {
    if (
      previewSelection.type === 'layer' &&
      !layers.some((layer) => layer.id === previewSelection.layerId)
    ) {
      setPreviewSelection(hasSource ? { type: 'source' } : { type: 'composite' });
    }
  }, [hasSource, layers, previewSelection]);

  useEffect(() => {
    if (
      previewSelection.type === 'source' &&
      !hasSource &&
      (hasResult || hasLayerResults)
    ) {
      setPreviewSelection({ type: 'composite' });
    }
  }, [hasLayerResults, hasResult, hasSource, previewSelection.type]);

  useEffect(() => {
    if (!hasLayerResults && !hasResult) {
      hasAutoSelectedResultRef.current = false;
      return;
    }

    if (
      !hasAutoSelectedResultRef.current &&
      previewSelection.type === 'source'
    ) {
      hasAutoSelectedResultRef.current = true;
      setPreviewSelection({ type: 'composite' });
    }
  }, [hasLayerResults, hasResult, previewSelection.type]);

  const renderLayerSilhouette = (
    layer: NonNullable<typeof selectedLayer>,
    index: number,
    size: 'stage' | 'thumb' = 'stage'
  ) => {
    const bounds = getLayerBounds(layer, index);
    return (
      <div
        className={`psd-layer-silhouette psd-layer-silhouette--${layer.type} psd-layer-silhouette--${size}`}
        style={{
          left: `${bounds.left}%`,
          top: `${bounds.top}%`,
          width: `${bounds.width}%`,
          height: `${bounds.height}%`,
        }}
      >
        {layer.type === 'text' ? (
          <>
            <span />
            <span />
            <span />
          </>
        ) : null}
        {layer.type === 'image' ? <i /> : null}
        {layer.type === 'decoration' ? (
          <>
            <i />
            <b />
          </>
        ) : null}
        {layer.type === 'adjustment' ? <em /> : null}
      </div>
    );
  };

  return (
    <div className="psd-workbench">
      <aside className="psd-workbench__setup">
        <section className="psd-tool-heading">
          <div className="psd-tool-heading__top">
            <span className="psd-tool-heading__eyebrow">
              <ImagePlus size={14} />
              {uiLanguage === 'zh'
                ? '图片转 PSD 分层文件'
                : 'Image to layered PSD'}
            </span>
            <span
              className={`psd-state-badge psd-state-badge--${workbenchTone}`}
            >
              {workbenchStateLabel}
            </span>
          </div>
          <h2>
            {uiLanguage === 'zh'
              ? 'Opentu PSD 工作台'
              : 'Opentu PSD Workbench'}
          </h2>
          <p>
            {uiLanguage === 'zh'
              ? '把原图拆成同画布透明图层，逐层预览、显隐和检查，保持 Photoshop 原位叠放边界清晰。'
              : 'Split the source into same-canvas transparent layers, then preview, toggle, and inspect each Photoshop-ready stacking boundary.'}
          </p>
          <div className="psd-tool-heading__metrics" aria-label="PSD progress">
            <span>
              <CheckCircle2 size={14} />
              {hasSource
                ? uiLanguage === 'zh'
                  ? '源图已上传'
                  : 'Source uploaded'
                : uiLanguage === 'zh'
                ? '等待上传'
                : 'Upload source'}
            </span>
            <span>
              <Layers size={14} />
              {layers.length > 0
                ? uiLanguage === 'zh'
                  ? plan?.analysis
                    ? `${layers.length} 层分析`
                    : `${layers.length} 层计划`
                  : plan?.analysis
                  ? `${layers.length} analyzed`
                  : `${layers.length} layers`
                : analysisStatus
                ? uiLanguage === 'zh'
                  ? '分析中'
                  : 'Analyzing'
                : uiLanguage === 'zh'
                ? '未规划'
                : 'No plan'}
            </span>
            <span>
              <FileArchive size={14} />
              {exportStateLabel}
            </span>
          </div>
        </section>

        {inputPanel}
        {errorPanel}
      </aside>

      <main className="psd-workbench__preview">
        <div className="psd-preview-toolbar">
          <div className="psd-preview-toolbar__title">
            <span className="psd-preview-toolbar__label">
              {uiLanguage === 'zh' ? '画布预览' : 'Canvas preview'}
            </span>
            <strong>{previewHeading}</strong>
            <div className="psd-preview-toolbar__meta">
              <span>
                {hasSource
                  ? uiLanguage === 'zh'
                    ? '源图'
                    : 'Source'
                  : uiLanguage === 'zh'
                  ? '未上传'
                  : 'No source'}
              </span>
            <span>
              {isLayerPreview
                ? uiLanguage === 'zh'
                  ? '单图层'
                  : 'Single layer'
                : isCompositeStackPreview
                ? uiLanguage === 'zh'
                  ? `${visibleLayerCount} 层叠放`
                  : `${visibleLayerCount} stacked`
                : hasResult || hasLayerResults
                ? uiLanguage === 'zh'
                  ? '结果态'
                    : 'Result state'
                  : uiLanguage === 'zh'
                  ? '待生成'
                  : 'Pending'}
              </span>
              <span>
                {uiLanguage === 'zh'
                  ? '同画布透明'
                  : 'Same-canvas transparent'}
              </span>
              <span>
                {uiLanguage === 'zh'
                  ? `可见 ${visibleLayerCount}/${layers.length || 0}`
                  : `Visible ${visibleLayerCount}/${layers.length || 0}`}
              </span>
            </div>
          </div>
          <div className="psd-preview-toolbar__actions">
            <button type="button" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
            <button type="button" onClick={fitView} aria-label="Fit">
              <Maximize2 size={16} />
            </button>
            <button type="button" onClick={resetView} aria-label="Center">
              <LocateFixed size={16} />
            </button>
          </div>
        </div>

        <div className="psd-stage-shell">
          {sourcePreviewUrl ? (
            <img
              className="psd-stage__source-probe"
              src={sourcePreviewUrl}
              alt=""
              aria-hidden="true"
              onLoad={(event) =>
                handleCanvasImageLoad(event, { force: true })
              }
            />
          ) : null}
          <nav
            className="psd-preview-strip"
            aria-label={
              uiLanguage === 'zh'
                ? 'PSD 预览目标'
                : 'PSD preview targets'
            }
          >
            <button
              type="button"
              className={`psd-preview-strip__item ${
                previewSelection.type === 'source'
                  ? 'psd-preview-strip__item--active'
                  : ''
              }`}
              onClick={selectSourcePreview}
              disabled={!sourcePreviewUrl}
            >
              <span className="psd-preview-strip__thumb">
                {sourcePreviewUrl ? (
                  <img src={sourcePreviewUrl} alt="" />
                ) : (
                  <FileImage size={18} />
                )}
              </span>
              <strong>{uiLanguage === 'zh' ? '原图' : 'Source'}</strong>
            </button>

            <button
              type="button"
              className={`psd-preview-strip__item ${
                previewSelection.type === 'composite'
                  ? 'psd-preview-strip__item--active'
                  : ''
              }`}
              onClick={selectCompositePreview}
              disabled={!sourcePreviewUrl && !previewUrl && !hasLayerResults}
            >
              <span className="psd-preview-strip__thumb psd-preview-strip__thumb--stack">
                <SquareStack size={18} />
              </span>
              <strong>{uiLanguage === 'zh' ? '叠放' : 'Stack'}</strong>
            </button>

            {layers.map((layer, index) => {
              const layerPreview = layerPreviewUrls[layer.id]?.[0];
              const isActive =
                previewSelection.type === 'layer' &&
                previewSelection.layerId === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  className={`psd-preview-strip__item ${
                    isActive ? 'psd-preview-strip__item--active' : ''
                  }`}
                  onClick={() => selectLayerPreview(layer.id)}
                  aria-label={
                    uiLanguage === 'zh'
                      ? `查看图层：${layer.name}`
                      : `View layer: ${layer.name}`
                  }
                >
                  <span className="psd-preview-strip__thumb psd-preview-strip__thumb--layer">
                    {layerPreview ? <img src={layerPreview} alt="" /> : null}
                    {!layerPreview ? renderLayerSilhouette(layer, index, 'thumb') : null}
                  </span>
                  <strong>{index + 1}</strong>
                </button>
              );
            })}
          </nav>

          <div
            className={`psd-stage ${
              isLayerPreview ? 'psd-stage--layer-preview' : ''
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <div className="psd-stage__canvas-meta">
              <span>{uiLanguage === 'zh' ? '工作画布' : 'Workbench'}</span>
              <strong>
                {isLayerPreview
                  ? uiLanguage === 'zh'
                    ? '同画布图层'
                    : 'Same-canvas layer'
                  : isCompositeStackPreview
                  ? uiLanguage === 'zh'
                    ? '图层叠放'
                    : 'Layer stack'
                  : hasResult || hasLayerResults
                  ? uiLanguage === 'zh'
                    ? 'PSD-ready'
                    : 'PSD-ready'
                  : uiLanguage === 'zh'
                  ? '源图'
                  : 'Source'}
              </strong>
            </div>
            <div
              ref={stageContentRef}
              className="psd-stage__content"
            >
              <div
                className="psd-stage__viewport"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                <div
                  className={`psd-stage__artboard ${
                    isLayerPreview || isCompositeStackPreview
                      ? 'psd-stage__artboard--transparent'
                      : ''
                  }`}
                  style={artboardStyle}
                >
                  {isCompositeStackPreview ? (
                    <div
                      className="psd-stage__stack"
                      aria-label={
                        uiLanguage === 'zh'
                          ? '同画布透明图层叠放预览'
                          : 'Same-canvas transparent layer stack preview'
                      }
                    >
                      {showSourceUnderlay && sourcePreviewUrl ? (
                        <img
                          className="psd-stage__stack-underlay"
                          src={sourcePreviewUrl}
                          alt={
                            uiLanguage === 'zh'
                              ? '原图对照底稿'
                              : 'Source comparison underlay'
                          }
                          onLoad={(event) =>
                            handleCanvasImageLoad(event, { force: true })
                          }
                        />
                      ) : null}
                      {visibleStackItems.map(({ layer, index, previewUrl }) =>
                        previewUrl ? (
                          <img
                            key={layer.id}
                            className="psd-stage__stack-layer"
                            src={previewUrl}
                            alt={
                              uiLanguage === 'zh'
                                ? `叠放图层：${layer.name}`
                                : `Stacked layer: ${layer.name}`
                            }
                            style={{ opacity: layer.opacity / 100 }}
                            onLoad={handleCanvasImageLoad}
                          />
                        ) : (
                          <React.Fragment key={layer.id}>
                            {renderLayerSilhouette(layer, index)}
                          </React.Fragment>
                        )
                      )}
                    </div>
                  ) : activePreviewUrl ? (
                    <img
                      className="psd-stage__artboard-image"
                      src={activePreviewUrl}
                      alt={
                        isLayerPreview
                          ? uiLanguage === 'zh'
                            ? `PSD 图层结果：${selectedLayer?.name}`
                            : `PSD layer result: ${selectedLayer?.name}`
                          : previewSelection.type === 'composite' &&
                            (hasResult || hasLayerResults)
                          ? uiLanguage === 'zh'
                            ? 'PSD 分层结果预览'
                            : 'PSD layered result preview'
                          : uiLanguage === 'zh'
                          ? '上传的原始图片'
                          : 'Uploaded source image'
                      }
                      onLoad={(event) =>
                        handleCanvasImageLoad(event, {
                          force:
                            previewSelection.type === 'source' ||
                            !hasLayerResults,
                        })
                      }
                    />
                  ) : null}

                  {!activePreviewUrl && !isLayerPreview && !isCompositeStackPreview ? (
                    <div className="psd-stage__empty">
                      <Layers size={42} />
                      <span>
                        {uiLanguage === 'zh'
                          ? '上传图片后在这里预览原图与生成结果'
                          : 'Upload an image to preview the source and result here'}
                      </span>
                    </div>
                  ) : null}

                  {isLayerPreview && selectedLayer ? (
                    <>
                      {!selectedLayerPreviewUrl
                        ? renderLayerSilhouette(
                            selectedLayer,
                            selectedLayerIndex
                          )
                        : null}
                      <div className="psd-stage__contract">
                        <ScanSearch size={14} />
                        <span>
                          {selectedLayerPreviewUrl
                            ? uiLanguage === 'zh'
                              ? '真实图层结果'
                              : 'Generated layer result'
                            : uiLanguage === 'zh'
                            ? '计划占位预览'
                            : 'Planned placeholder'}
                        </span>
                        <strong>
                          {uiLanguage === 'zh'
                            ? '同画布 / 原坐标 / 透明背景'
                            : 'Same canvas / original coordinates / transparent background'}
                        </strong>
                      </div>
                    </>
                  ) : null}

                  {shouldShowLayerGuides && visibleLayers.map((layer, index) => {
                    const bounds = getLayerBounds(layer, index);
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        className={`psd-stage__layer-outline psd-stage__layer-outline--${layer.type}`}
                        style={{
                          left: `${bounds.left}%`,
                          top: `${bounds.top}%`,
                          width: `${bounds.width}%`,
                          height: `${bounds.height}%`,
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectLayerPreview(layer.id);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <span>{layer.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="psd-stage-footer">
            <div className="psd-stage-hint">
              <Move size={14} />
              <span>
                {uiLanguage === 'zh'
                  ? `拖拽平移，缩放检查；隐藏 ${hiddenLayerCount} 层。`
                  : `Drag to pan and zoom to inspect; ${hiddenLayerCount} hidden.`}
              </span>
            </div>
            {isCompositeStackPreview ? (
              <div
                className="psd-stage__stack-dock"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="psd-stage__stack-dock-header">
                  <span>
                    {uiLanguage === 'zh'
                      ? '叠放顺序'
                      : 'Stack order'}
                  </span>
                  <div className="psd-stage__stack-dock-actions">
                    <span>
                      {uiLanguage === 'zh'
                        ? `${generatedStackLayerCount}/${visibleLayerCount} 层已有结果`
                        : `${generatedStackLayerCount}/${visibleLayerCount} generated`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setShowLayerGuides((current) => !current)
                      }
                      aria-pressed={showLayerGuides}
                      disabled={!hasLayerResults}
                    >
                      <ScanSearch size={13} />
                      {showLayerGuides
                        ? uiLanguage === 'zh'
                          ? '隐藏边界'
                          : 'Hide guides'
                        : uiLanguage === 'zh'
                        ? '显示边界'
                        : 'Show guides'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setShowSourceUnderlay((current) => !current)
                      }
                      aria-pressed={showSourceUnderlay}
                      disabled={!sourcePreviewUrl}
                    >
                      <Eye size={13} />
                      {showSourceUnderlay
                        ? uiLanguage === 'zh'
                          ? '隐藏原图'
                          : 'Hide source'
                        : uiLanguage === 'zh'
                        ? '原图对照'
                        : 'Compare source'}
                    </button>
                  </div>
                </div>
                <div className="psd-stage__stack-chip-list">
                  {layerStackItems.map(({ layer, previewUrl, isHidden }, index) => (
                    <div
                      key={layer.id}
                      className={`psd-stage__stack-chip ${
                        isHidden ? 'psd-stage__stack-chip--hidden' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="psd-stage__stack-chip-main"
                        onClick={() => selectLayerPreview(layer.id)}
                      >
                        <span className="psd-stage__stack-chip-index">
                          {index + 1}
                        </span>
                        <span
                          className={`psd-stage__stack-chip-dot psd-stage__stack-chip-dot--${layer.type}`}
                        />
                        <strong>{layer.name}</strong>
                        <small>
                          {isHidden
                            ? uiLanguage === 'zh'
                              ? '隐藏'
                              : 'Hidden'
                            : previewUrl
                            ? uiLanguage === 'zh'
                              ? '已叠放'
                              : 'Stacked'
                            : uiLanguage === 'zh'
                            ? '计划占位'
                            : 'Planned'}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="psd-stage__stack-chip-eye"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        aria-pressed={!isHidden}
                        aria-label={
                          isHidden
                            ? uiLanguage === 'zh'
                              ? `显示图层：${layer.name}`
                              : `Show layer: ${layer.name}`
                            : uiLanguage === 'zh'
                            ? `隐藏图层：${layer.name}`
                            : `Hide layer: ${layer.name}`
                        }
                      >
                        {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {analysisStatus ? (
          <section
            className={`psd-generation-status psd-generation-status--${
              analysisTone || 'active'
            }`}
            role="status"
          >
            <strong>{analysisStatus.title}</strong>
            <span className="psd-generation-status__counts">
              {uiLanguage === 'zh'
                ? `${analysisStatus.model} · 高思考图片分析`
                : `${analysisStatus.model} · high-reasoning image analysis`}
            </span>
            <span>{analysisStatus.detail}</span>
            <div
              className="psd-generation-status__progress"
              aria-label={
                uiLanguage === 'zh'
                  ? 'PSD 图层分析进度'
                  : 'PSD layer analysis progress'
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={analysisStatus.state === 'completed' ? 100 : 44}
              role="progressbar"
            >
              <span
                style={{
                  width: `${
                    analysisStatus.state === 'completed'
                      ? 100
                      : analysisStatus.state === 'failed'
                      ? 100
                      : 44
                  }%`,
                }}
              />
            </div>
          </section>
        ) : null}

        {status ? (
          <section
            className={`psd-generation-status psd-generation-status--${status.tone}`}
            role="status"
          >
            <strong>{status.title}</strong>
            <span className="psd-generation-status__counts">
              {status.countSummary}
            </span>
            <span>{status.detail}</span>
            <div
              className="psd-generation-status__progress"
              aria-label={
                uiLanguage === 'zh'
                  ? 'PSD-ready 任务进度'
                  : 'PSD-ready task progress'
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status.progressPercent}
              role="progressbar"
            >
              <span style={{ width: `${status.progressPercent}%` }} />
            </div>
          </section>
        ) : null}
      </main>

      <aside className="psd-workbench__layers">
        <section className="psd-layer-panel">
          <div className="psd-layer-panel__header">
            <div>
              <span>{uiLanguage === 'zh' ? '图层栈' : 'Layer stack'}</span>
              <strong>
                {layers.length > 0
                  ? uiLanguage === 'zh'
                    ? plan?.analysis
                      ? `${layers.length} 个动态图层`
                      : `${layers.length} 个计划图层`
                    : plan?.analysis
                    ? `${layers.length} dynamic layers`
                    : `${layers.length} planned layers`
                  : analysisStatus
                  ? uiLanguage === 'zh'
                    ? '等待模型分析结果'
                    : 'Waiting for model analysis'
                  : uiLanguage === 'zh'
                  ? '等待生成图层计划'
                  : 'Waiting for layer plan'}
              </strong>
            </div>
            <span className="psd-layer-panel__visible-count">
              <PanelRight size={15} />
              {uiLanguage === 'zh'
                ? `${visibleLayerCount} 可见`
                : `${visibleLayerCount} visible`}
            </span>
          </div>

          <div className="psd-layer-list">
            {layers.length > 0 ? (
              layers.map((layer, index) => {
                const isHidden = hiddenLayerIds.has(layer.id);
                const isSelected = layer.id === activeLayerId;
                return (
                  <div
                    key={layer.id}
                    className={`psd-layer-row ${
                      isSelected ? 'psd-layer-row--selected' : ''
                    } ${isHidden ? 'psd-layer-row--hidden' : ''}`}
                  >
                    <button
                      type="button"
                      className="psd-layer-row__main"
                      onClick={() => selectLayerPreview(layer.id)}
                    >
                      <span
                        className={`psd-layer-row__swatch psd-layer-row__swatch--${layer.type}`}
                      />
                      <span>
                        <strong>{layer.name}</strong>
                        <small>
                          {getLayerTypeLabel(layer.type, uiLanguage)} ·{' '}
                          {layer.opacity}%
                        </small>
                      </span>
                    </button>
                    <span
                      className={`psd-layer-row__status psd-layer-row__status--${
                        status?.tone || layer.status
                      }`}
                    >
                      {getLayerStatusLabel(layer, status, uiLanguage)}
                    </span>
                    <button
                      type="button"
                      className="psd-layer-row__view"
                      onClick={() => selectLayerPreview(layer.id)}
                    >
                      <MousePointer2 size={14} />
                      <span>{uiLanguage === 'zh' ? '查看' : 'View'}</span>
                    </button>
                    <button
                      type="button"
                      className="psd-layer-row__visibility"
                      onClick={() => toggleLayerVisibility(layer.id)}
                      aria-pressed={!isHidden}
                      aria-label={
                        isHidden
                          ? uiLanguage === 'zh'
                            ? `显示图层：${layer.name}`
                            : `Show layer: ${layer.name}`
                          : uiLanguage === 'zh'
                          ? `隐藏图层：${layer.name}`
                          : `Hide layer: ${layer.name}`
                      }
                    >
                      {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <span className="psd-layer-row__index">{index + 1}</span>
                  </div>
                );
              })
            ) : (
              <div className="psd-layer-list__empty">
                {uiLanguage === 'zh'
                  ? '上传原图并点击生成后，系统会先调用 gpt-5.5 高思考分析真实视觉元素；分析完成前不会创建固定模板图层。'
                  : 'Upload a source and generate to run gpt-5.5 high-reasoning visual analysis first; fixed-template layers are not created before analysis completes.'}
              </div>
            )}
          </div>

          {selectedLayer ? (
            <div className="psd-layer-inspector">
              <span>{uiLanguage === 'zh' ? '选中图层' : 'Selected layer'}</span>
              <strong>{selectedLayer.name}</strong>
              <p>{selectedLayer.description}</p>
              <dl>
                <div>
                  <dt>{uiLanguage === 'zh' ? '类型' : 'Type'}</dt>
                  <dd>{getLayerTypeLabel(selectedLayer.type, uiLanguage)}</dd>
                </div>
                <div>
                  <dt>{uiLanguage === 'zh' ? '透明度' : 'Opacity'}</dt>
                  <dd>{selectedLayer.opacity}%</dd>
                </div>
                <div>
                  <dt>{uiLanguage === 'zh' ? '状态' : 'State'}</dt>
                  <dd>
                    {getLayerStatusLabel(selectedLayer, status, uiLanguage)}
                  </dd>
                </div>
                <div>
                  <dt>{uiLanguage === 'zh' ? '画布' : 'Canvas'}</dt>
                  <dd>
                    {canvasSize
                      ? `${canvasSize.width} x ${canvasSize.height}`
                      : uiLanguage === 'zh'
                      ? '同源图'
                      : 'Same as source'}
                  </dd>
                </div>
                <div>
                  <dt>{uiLanguage === 'zh' ? '坐标' : 'Coordinates'}</dt>
                  <dd>
                    {selectedLayerBounds
                      ? `${Math.round(selectedLayerBounds.left)}%, ${Math.round(
                          selectedLayerBounds.top
                        )}%`
                      : uiLanguage === 'zh'
                      ? '原位'
                      : 'In place'}
                  </dd>
                </div>
                <div>
                  <dt>{uiLanguage === 'zh' ? '结果' : 'Result'}</dt>
                  <dd>
                    {selectedLayerPreviewUrl
                      ? uiLanguage === 'zh'
                        ? '已生成'
                        : 'Generated'
                      : uiLanguage === 'zh'
                      ? '待生成'
                      : 'Pending'}
                  </dd>
                </div>
              </dl>
              <div className="psd-layer-inspector__contract">
                <CheckCircle2 size={14} />
                <span>
                  {uiLanguage === 'zh'
                    ? 'PSD 语义：同画布、原坐标、透明背景，导入 Photoshop 后无需移动缩放即可叠放还原。'
                    : 'PSD semantics: same canvas, original coordinates, transparent background, and in-place Photoshop stacking without moving or scaling.'}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="psd-export-card">
          <span className="psd-export-card__eyebrow">
            {uiLanguage === 'zh' ? '导出' : 'Export'}
          </span>
          <h3>
            {uiLanguage === 'zh'
              ? '下载 PSD-ready 工作区'
              : 'Download PSD-ready workspace'}
          </h3>
          <p>{getExportMessage(canDownload, uiLanguage)}</p>
          <div className="psd-export-card__assets">
            <span>{uiLanguage === 'zh' ? '生成图' : 'Generated'}</span>
            <span>{uiLanguage === 'zh' ? '源图' : 'Source'}</span>
            <span>manifest</span>
            <span>{uiLanguage === 'zh' ? '接力说明' : 'Handoff'}</span>
          </div>
          <button
            type="button"
            className="psd-export-card__button"
            disabled={!canDownload || isDownloading}
            onClick={onDownload}
          >
            <Download size={16} />
            <span>
              {uiLanguage === 'zh'
                ? '下载工作区包'
                : 'Download workspace'}
            </span>
          </button>
          <dl>
            <div>
              <dt>{uiLanguage === 'zh' ? '生成结果' : 'Results'}</dt>
              <dd>{resultCount}</dd>
            </div>
            <div>
              <dt>{uiLanguage === 'zh' ? '原生 PSD' : 'Native PSD'}</dt>
              <dd>{uiLanguage === 'zh' ? '待打包器' : 'Packer pending'}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
