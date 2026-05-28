import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  FileImage,
  Layers,
  LocateFixed,
  Maximize2,
  ScanSearch,
  SquareStack,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clamp,
  getLayerBounds,
  type LayerBounds,
} from '../ai-psd-workflow-view-utils';
import type { ReferenceImage } from '../shared';
import type { PsdPreviewSelection } from './psd-workbench-types';

type PsdLayer = PsdGenerationPlan['layers'][number];

interface PsdCanvasStageProps {
  uiLanguage: 'zh' | 'en';
  plan: PsdGenerationPlan | null;
  sourceImages: ReferenceImage[];
  previewUrl?: string;
  layerPreviewUrls?: Record<string, string[]>;
  isEmptyWorkspace: boolean;
  isAnalyzingWorkspace: boolean;
  activeLayerId?: string | null;
  onCanvasSizeChange: (size: { width: number; height: number } | null) => void;
  onSelectionChange: (context: {
    activeLayerId: string | null;
    selectedLayerBounds: LayerBounds | null;
  }) => void;
}

interface PsdCanvasStageToolbarProps {
  uiLanguage: 'zh' | 'en';
  heading: string;
  isLayerPreview: boolean;
  isCompositeStackPreview: boolean;
  hasLayerResults: boolean;
  visibleLayerCount: number;
  layerCount: number;
  zoom: number;
  showLayerGuides: boolean;
  showSourceUnderlay: boolean;
  guidesDisabled: boolean;
  underlayDisabled: boolean;
  onToggleGuides: () => void;
  onToggleUnderlay: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}

function PsdCanvasStageToolbar({
  uiLanguage,
  heading,
  isLayerPreview,
  isCompositeStackPreview,
  hasLayerResults,
  visibleLayerCount,
  layerCount,
  zoom,
  showLayerGuides,
  showSourceUnderlay,
  guidesDisabled,
  underlayDisabled,
  onToggleGuides,
  onToggleUnderlay,
  onZoomOut,
  onZoomIn,
  onFit,
}: PsdCanvasStageToolbarProps) {
  return (
    <div className="psd-preview-toolbar">
      <div className="psd-preview-toolbar__title">
        <span className="psd-preview-toolbar__label">
          {uiLanguage === 'zh' ? '画布预览' : 'Canvas preview'}
        </span>
        <strong>{heading}</strong>
        <div className="psd-preview-toolbar__meta">
          <span>{isLayerPreview ? uiLanguage === 'zh' ? '单层目标' : 'Layer target' : isCompositeStackPreview ? uiLanguage === 'zh' ? `${visibleLayerCount} 层叠放` : `${visibleLayerCount} stacked` : hasLayerResults ? uiLanguage === 'zh' ? '结果对照' : 'Result compare' : uiLanguage === 'zh' ? '准备中' : 'Preparing'}</span>
          <span>{uiLanguage === 'zh' ? `可见 ${visibleLayerCount}/${layerCount}` : `Visible ${visibleLayerCount}/${layerCount}`}</span>
        </div>
      </div>

      <div className="psd-preview-toolbar__actions">
        <button
          type="button"
          className="psd-preview-toolbar__toggle"
          onClick={onToggleGuides}
          aria-pressed={showLayerGuides}
          disabled={guidesDisabled}
          aria-label={uiLanguage === 'zh' ? '显示图层边界' : 'Show layer guides'}
        >
          <ScanSearch size={16} />
        </button>
        <button
          type="button"
          className="psd-preview-toolbar__toggle"
          onClick={onToggleUnderlay}
          aria-pressed={showSourceUnderlay}
          disabled={underlayDisabled}
          aria-label={uiLanguage === 'zh' ? '原图对照' : 'Compare source'}
        >
          <Eye size={16} />
        </button>
        <span className="psd-preview-toolbar__divider" aria-hidden="true" />
        <button type="button" onClick={onZoomOut} aria-label="Zoom out"><ZoomOut size={16} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in"><ZoomIn size={16} /></button>
        <button type="button" onClick={onFit} aria-label="Fit"><Maximize2 size={16} /></button>
        <button type="button" onClick={onFit} aria-label="Center"><LocateFixed size={16} /></button>
      </div>
    </div>
  );
}

interface PsdPreviewStripProps {
  uiLanguage: 'zh' | 'en';
  layers: PsdLayer[];
  sourcePreviewUrl?: string;
  selectedLayerId: string | null;
  previewSelection: PsdPreviewSelection;
  layerPreviewUrls: Record<string, string[]>;
  onSelectSource: () => void;
  onSelectComposite: () => void;
  onSelectLayer: (layerId: string) => void;
}

function PsdPreviewStrip({
  uiLanguage,
  layers,
  sourcePreviewUrl,
  selectedLayerId,
  previewSelection,
  layerPreviewUrls,
  onSelectSource,
  onSelectComposite,
  onSelectLayer,
}: PsdPreviewStripProps) {
  if (layers.length === 0) return null;

  return (
    <nav className="psd-preview-strip" aria-label={uiLanguage === 'zh' ? 'PSD 预览目标' : 'PSD preview targets'}>
      <button
        type="button"
        className={`psd-preview-strip__item ${previewSelection.type === 'source' ? 'psd-preview-strip__item--active' : ''}`}
        onClick={onSelectSource}
        disabled={!sourcePreviewUrl}
      >
        <span className="psd-preview-strip__thumb">
          {sourcePreviewUrl ? <img src={sourcePreviewUrl} alt="" /> : <FileImage size={18} />}
        </span>
        <strong>{uiLanguage === 'zh' ? '原图' : 'Source'}</strong>
      </button>

      <button
        type="button"
        className={`psd-preview-strip__item ${previewSelection.type === 'composite' ? 'psd-preview-strip__item--active' : ''}`}
        onClick={onSelectComposite}
      >
        <span className="psd-preview-strip__thumb psd-preview-strip__thumb--stack"><SquareStack size={18} /></span>
        <strong>{uiLanguage === 'zh' ? '叠放' : 'Stack'}</strong>
      </button>

      {layers.map((layer, index) => {
        const layerPreviewUrl = layerPreviewUrls[layer.id]?.[0];
        const isSelected = selectedLayerId === layer.id;
        return (
          <button
            key={layer.id}
            type="button"
            className={`psd-preview-strip__item ${isSelected ? 'psd-preview-strip__item--active' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
            aria-label={uiLanguage === 'zh' ? `查看图层：${layer.name}` : `View layer: ${layer.name}`}
          >
            <span className={`psd-preview-strip__thumb psd-preview-strip__thumb--${layer.type}`}>
              {layerPreviewUrl ? <img src={layerPreviewUrl} alt="" /> : <span>{layer.name.slice(0, 1)}</span>}
            </span>
            <strong>{index + 1}</strong>
          </button>
        );
      })}
    </nav>
  );
}

export function PsdCanvasStage({
  uiLanguage,
  plan,
  sourceImages,
  previewUrl,
  layerPreviewUrls = {},
  isEmptyWorkspace,
  isAnalyzingWorkspace,
  activeLayerId: requestedLayerId,
  onCanvasSizeChange,
  onSelectionChange,
}: PsdCanvasStageProps) {
  const sourcePreviewUrl = sourceImages[0]?.url;
  const layers = useMemo(() => plan?.layers || [], [plan?.layers]);
  const [previewSelection, setPreviewSelection] = useState<PsdPreviewSelection>({ type: 'source' });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [stageViewportSize, setStageViewportSize] = useState<{ width: number; height: number } | null>(null);
  const [showSourceUnderlay, setShowSourceUnderlay] = useState(false);
  const [showLayerGuides, setShowLayerGuides] = useState(true);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const hasAutoSelectedResultRef = useRef(false);
  const lastRequestedLayerIdRef = useRef<string | null | undefined>(requestedLayerId);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  const selectedLayerId = previewSelection.type === 'layer' ? previewSelection.layerId : null;
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedLayerIndex = selectedLayer ? layers.findIndex((layer) => layer.id === selectedLayer.id) : -1;
  const selectedLayerBounds = useMemo(
    () => selectedLayer && selectedLayerIndex >= 0 ? getLayerBounds(selectedLayer, selectedLayerIndex) : null,
    [selectedLayer, selectedLayerIndex]
  );
  const visibleLayers = useMemo(() => layers.filter((layer) => layer.visible !== false), [layers]);
  // 渲染全部图层（含隐藏的），用透明度切换显隐——隐藏的图层保持挂载，
  // 重新显示时无需重新加载/解码，配合 CSS 过渡实现平滑淡入淡出、消除闪烁。
  const stackItems = useMemo(
    () =>
      layers.map((layer, index) => ({
        layer,
        index,
        previewUrl: layerPreviewUrls[layer.id]?.[0],
        hidden: layer.visible === false,
      })),
    [layerPreviewUrls, layers]
  );
  const activeLayerId = selectedLayer?.id || null;
  const selectedLayerPreviewUrl = activeLayerId ? layerPreviewUrls[activeLayerId]?.[0] : undefined;
  const hasSource = sourceImages.length > 0;
  const hasResult = Boolean(previewUrl);
  const hasLayerResults = Object.values(layerPreviewUrls).some((urls) => urls.length > 0);
  const isCompositeStackPreview = previewSelection.type === 'composite' && layers.length > 0;
  const shouldRenderCompositeStack = isCompositeStackPreview && (!hasResult || hasLayerResults);
  const isLayerPreview = previewSelection.type === 'layer' && !!selectedLayer;
  const isSourcePreview = previewSelection.type === 'source';
  const visibleLayerCount = visibleLayers.length;
  const shouldShowLayerGuides =
    !isLayerPreview &&
    visibleLayers.length > 0 &&
    (showLayerGuides || (shouldRenderCompositeStack && !hasLayerResults));
  const activePreviewUrl = isLayerPreview
    ? selectedLayerPreviewUrl
    : shouldRenderCompositeStack
    ? undefined
    : previewSelection.type === 'composite'
    ? previewUrl || sourcePreviewUrl
    : sourcePreviewUrl || previewUrl;
  const shouldShowActiveImage =
    Boolean(activePreviewUrl) && !shouldRenderCompositeStack;
  const canvasAspectRatio = canvasSize ? `${canvasSize.width} / ${canvasSize.height}` : '1 / 1';
  const fittedArtboardSize = useMemo(() => {
    if (!canvasSize || !stageViewportSize) return null;
    const availableWidth = Math.max(stageViewportSize.width - 28, 160);
    const availableHeight = Math.max(stageViewportSize.height - 28, 160);
    const fittedScale = Math.min(availableWidth / canvasSize.width, availableHeight / canvasSize.height, 1);
    return {
      width: Math.max(Math.round(canvasSize.width * fittedScale), 1),
      height: Math.max(Math.round(canvasSize.height * fittedScale), 1),
    };
  }, [canvasSize, stageViewportSize]);
  const artboardStyle: React.CSSProperties = {
    aspectRatio: canvasAspectRatio,
    ...(fittedArtboardSize ? { width: `${fittedArtboardSize.width}px`, height: `${fittedArtboardSize.height}px` } : {}),
  };
  const previewHeading = isLayerPreview
    ? uiLanguage === 'zh' ? `查看图层：${selectedLayer?.name}` : `Viewing layer: ${selectedLayer?.name}`
    : previewSelection.type === 'composite'
    ? shouldRenderCompositeStack
      ? hasLayerResults
        ? uiLanguage === 'zh' ? '分层结果叠放预览' : 'Layer stack preview'
        : uiLanguage === 'zh' ? '计划图层叠放预览' : 'Planned layer stack'
      : hasResult
      ? uiLanguage === 'zh' ? 'PSD 分层结果预览' : 'PSD layered result preview'
      : uiLanguage === 'zh' ? '计划图层叠放预览' : 'Planned layer stack'
    : sourcePreviewUrl
    ? uiLanguage === 'zh' ? '源图预览' : 'Source preview'
    : uiLanguage === 'zh' ? '源图等待区' : 'Source intake area';
  const activePreviewAlt = isLayerPreview
    ? uiLanguage === 'zh' ? `PSD 图层结果：${selectedLayer?.name}` : `PSD layer result: ${selectedLayer?.name}`
    : previewSelection.type === 'composite' && (hasResult || hasLayerResults)
    ? uiLanguage === 'zh' ? 'PSD 分层结果预览' : 'PSD layered result preview'
    : isAnalyzingWorkspace
    ? uiLanguage === 'zh' ? '正在扫描的源图' : 'Scanning source image'
    : uiLanguage === 'zh' ? '上传的原始图片' : 'Uploaded source image';

  const fitView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);
  const selectSourcePreview = useCallback(() => { fitView(); setPreviewSelection({ type: 'source' }); }, [fitView]);
  const selectCompositePreview = useCallback(() => { fitView(); setPreviewSelection({ type: 'composite' }); }, [fitView]);
  const selectLayerPreview = useCallback((layerId: string) => { fitView(); setPreviewSelection({ type: 'layer', layerId }); }, [fitView]);

  const handleCanvasImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>, options: { force?: boolean } = {}) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setCanvasSize((current) => options.force || !current ? { width: naturalWidth, height: naturalHeight } : current);
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) return;
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setIsDraggingCanvas(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pan.x, pan.y]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
  }, []);
  const stopDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null;
      setIsDraggingCanvas(false);
    }
  }, []);

  const renderLayerSilhouette = (layer: PsdLayer, index: number) => {
    const bounds = getLayerBounds(layer, index);
    return (
      <div key={layer.id} className={`psd-layer-silhouette psd-layer-silhouette--${layer.type}`} style={{ left: `${bounds.left}%`, top: `${bounds.top}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }}>
        {layer.type === 'text' ? <><span /><span /><span /></> : null}
        {layer.type === 'image' ? <i /> : null}
        {layer.type === 'decoration' ? <><i /><b /></> : null}
        {layer.type === 'adjustment' ? <em /> : null}
      </div>
    );
  };

  useEffect(() => { onCanvasSizeChange(canvasSize); }, [canvasSize, onCanvasSizeChange]);
  useEffect(() => {
    onSelectionChange({ activeLayerId, selectedLayerBounds });
  }, [activeLayerId, onSelectionChange, selectedLayerBounds]);
  // Bridge: an external selection (right-rail layer card) drives the canvas
  // preview. Only react to actual changes of the external request, never to the
  // canvas's own selection — otherwise a local click would race the round-trip
  // through onSelectionChange and flicker between layers.
  useEffect(() => {
    if (requestedLayerId === lastRequestedLayerIdRef.current) return;
    lastRequestedLayerIdRef.current = requestedLayerId;
    if (
      requestedLayerId &&
      requestedLayerId !== activeLayerId &&
      layers.some((layer) => layer.id === requestedLayerId)
    ) {
      selectLayerPreview(requestedLayerId);
    }
  }, [requestedLayerId, activeLayerId, layers, selectLayerPreview]);
  useEffect(() => {
    const node = stageContentRef.current;
    if (!node) return undefined;
    const updateStageSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setStageViewportSize({ width: rect.width, height: rect.height });
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
  useEffect(() => { if (!shouldRenderCompositeStack) setShowSourceUnderlay(false); }, [shouldRenderCompositeStack]);
  useEffect(() => { if (hasLayerResults) setShowLayerGuides(false); }, [hasLayerResults]);
  useEffect(() => {
    if (previewSelection.type === 'layer' && !layers.some((layer) => layer.id === previewSelection.layerId)) {
      setPreviewSelection(hasSource ? { type: 'source' } : { type: 'composite' });
    }
  }, [hasSource, layers, previewSelection]);
  useEffect(() => {
    if (previewSelection.type === 'source' && !hasSource && (hasResult || hasLayerResults)) {
      setPreviewSelection({ type: 'composite' });
    }
  }, [hasLayerResults, hasResult, hasSource, previewSelection.type]);
  useEffect(() => {
    if (!hasLayerResults && !hasResult) {
      hasAutoSelectedResultRef.current = false;
      return;
    }
    if (!hasAutoSelectedResultRef.current && previewSelection.type === 'source') {
      hasAutoSelectedResultRef.current = true;
      setPreviewSelection({ type: 'composite' });
    }
  }, [hasLayerResults, hasResult, previewSelection.type]);

  return (
    <main className="psd-workbench__preview">
      <PsdCanvasStageToolbar
        uiLanguage={uiLanguage}
        heading={previewHeading}
        isLayerPreview={isLayerPreview}
        isCompositeStackPreview={shouldRenderCompositeStack}
        hasLayerResults={hasResult || hasLayerResults}
        visibleLayerCount={visibleLayerCount}
        layerCount={layers.length}
        zoom={zoom}
        showLayerGuides={showLayerGuides}
        showSourceUnderlay={showSourceUnderlay}
        guidesDisabled={visibleLayers.length === 0}
        underlayDisabled={!sourcePreviewUrl || !shouldRenderCompositeStack}
        onToggleGuides={() => setShowLayerGuides((current) => !current)}
        onToggleUnderlay={() => setShowSourceUnderlay((current) => !current)}
        onZoomOut={() => setZoom((current) => clamp(current - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
        onZoomIn={() => setZoom((current) => clamp(current + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
        onFit={fitView}
      />

      <div className="psd-stage-shell">
        {sourcePreviewUrl ? <img className="psd-stage__source-probe" src={sourcePreviewUrl} alt="" aria-hidden="true" onLoad={(event) => handleCanvasImageLoad(event, { force: true })} /> : null}
        <div
          ref={stageContentRef}
          className={`psd-stage__content ${isDraggingCanvas ? 'psd-stage__content--dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
        >
          <div className="psd-stage__viewport" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div className="psd-stage__artboard psd-stage__artboard--transparent" style={artboardStyle}>
              {shouldShowActiveImage ? (
                <img
                  className="psd-stage__artboard-image"
                  src={activePreviewUrl}
                  alt={activePreviewAlt}
                  data-psd-preview-kind={isLayerPreview ? 'layer' : isSourcePreview ? 'source' : 'result'}
                  onLoad={(event) => handleCanvasImageLoad(event, { force: isSourcePreview || isEmptyWorkspace || isAnalyzingWorkspace || !hasLayerResults })}
                />
              ) : null}
              {isAnalyzingWorkspace ? <><div className="psd-analysis-scanner-line" /><div className="psd-analysis-scanner-overlay" /></> : null}
              {!sourcePreviewUrl && !activePreviewUrl && layers.length === 0 ? (
                <div className="psd-stage__empty psd-stage__empty--source-waiting">
                  <Layers size={42} className="psd-stage__empty-icon psd-stage__empty-icon--muted" />
                  <span>{uiLanguage === 'zh' ? '等待左侧上传海报参考图；画布、图层与导出面板会保持在同一工作区。' : 'Waiting for a reference poster on the left; canvas, layers, and export stay in one workspace.'}</span>
                </div>
              ) : null}
              {layers.length > 0 && plan ? (
                <>
                  {shouldRenderCompositeStack ? (
                    <div className="psd-stage__stack" aria-label={uiLanguage === 'zh' ? '同画布透明图层叠放预览' : 'Same-canvas transparent layer stack preview'}>
                      {showSourceUnderlay && sourcePreviewUrl ? <img className="psd-stage__stack-underlay" src={sourcePreviewUrl} alt={uiLanguage === 'zh' ? '原图对照底稿' : 'Source comparison underlay'} onLoad={(event) => handleCanvasImageLoad(event, { force: true })} /> : null}
                      {stackItems.map(({ layer, index, previewUrl, hidden }) => previewUrl ? (
                        <img
                          key={layer.id}
                          className={`psd-stage__stack-layer${hidden ? ' psd-stage__stack-layer--hidden' : ''}`}
                          src={previewUrl}
                          alt={uiLanguage === 'zh' ? `叠放图层：${layer.name}` : `Stacked layer: ${layer.name}`}
                          style={{ opacity: hidden ? 0 : layer.opacity / 100 }}
                          aria-hidden={hidden}
                          onLoad={handleCanvasImageLoad}
                        />
                      ) : hidden ? null : renderLayerSilhouette(layer, index))}
                    </div>
                  ) : null}

                  {isLayerPreview && selectedLayer ? (
                    <>
                      {!selectedLayerPreviewUrl ? renderLayerSilhouette(selectedLayer, selectedLayerIndex) : null}
                      <div className="psd-stage__contract">
                        <ScanSearch size={14} />
                        <span>{selectedLayerPreviewUrl ? uiLanguage === 'zh' ? '真实图层结果' : 'Generated layer result' : uiLanguage === 'zh' ? '计划占位预览' : 'Planned placeholder'}</span>
                        <strong>{uiLanguage === 'zh' ? '同画布 / 原坐标 / 透明背景' : 'Same canvas / original coordinates / transparent background'}</strong>
                      </div>
                    </>
                  ) : null}

                  {shouldShowLayerGuides ? visibleLayers.map((layer, index) => {
                    const bounds = getLayerBounds(layer, index);
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        className={`psd-stage__layer-outline psd-stage__layer-outline--${layer.type}`}
                        style={{ left: `${bounds.left}%`, top: `${bounds.top}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }}
                        onClick={(event) => { event.stopPropagation(); selectLayerPreview(layer.id); }}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <span>{layer.name}</span>
                      </button>
                    );
                  }) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PsdPreviewStrip
        uiLanguage={uiLanguage}
        layers={layers}
        sourcePreviewUrl={sourcePreviewUrl}
        selectedLayerId={selectedLayerId}
        previewSelection={previewSelection}
        layerPreviewUrls={layerPreviewUrls}
        onSelectSource={selectSourcePreview}
        onSelectComposite={selectCompositePreview}
        onSelectLayer={selectLayerPreview}
      />
    </main>
  );
}
