/**
 * gpt-image-2 自定义分辨率编辑器
 *
 * 内联渲染在「图片尺寸」参数区，选中「自定义」选项后展开。
 * 宽/高输入失焦时自动吸附到最近的合法尺寸（16 倍数、长边 ≤3840、≤3:1、0.66~8.29MP），
 * 并实时渲染按比例的预览方块 + 比例/像素/档位读数。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, AlertTriangle } from 'lucide-react';
import {
  getGPTImage2SizeInfo,
  parseGPTImage2PixelSize,
  snapToValidGPTImage2Size,
  GPT_IMAGE_2_MAX_LONG_EDGE,
  GPT_IMAGE_2_SIZE_STEP,
} from '../../services/model-adapters/image-size-quality-resolver';
import { HoverTip } from '../shared/hover';
import './gpt-image-custom-size-editor.scss';

/** 默认进入自定义模式时的尺寸（3:2，1K 档，合法） */
export const DEFAULT_GPT_IMAGE_2_CUSTOM_SIZE = '1536x1024';

interface QuickSize {
  label: string;
  value: string;
}

const QUICK_SIZES: QuickSize[] = [
  { label: '1536×1024', value: '1536x1024' },
  { label: '1024×1536', value: '1024x1536' },
  { label: '2048×2048', value: '2048x2048' },
  { label: '2736×1536', value: '2736x1536' },
  { label: '3328×1872', value: '3328x1872' },
  { label: '3840×2160', value: '3840x2160' },
];

export interface GptImageCustomSizeEditorProps {
  /** 当前 size 值（像素串，如 "1536x1024"） */
  value: string;
  /** 变更回调；编辑过程中传 keepOpen 以保持下拉打开 */
  onChange: (value: string, options?: { keepOpen?: boolean }) => void;
  language?: 'zh' | 'en';
}

const PREVIEW_MAX = 72; // 预览方块最长边像素

const t = (language: 'zh' | 'en', zh: string, en: string): string =>
  language === 'zh' ? zh : en;

export const GptImageCustomSizeEditor: React.FC<
  GptImageCustomSizeEditorProps
> = ({ value, onChange, language = 'zh' }) => {
  // 解析外部值作为初始/受控基准
  const parsed = useMemo(
    () => parseGPTImage2PixelSize(value),
    [value]
  );

  // 本地输入态（允许用户中途输入非法值，失焦再吸附）
  const [widthInput, setWidthInput] = useState<string>(
    String(parsed?.width ?? 1536)
  );
  const [heightInput, setHeightInput] = useState<string>(
    String(parsed?.height ?? 1024)
  );
  const [snapNotice, setSnapNotice] = useState<string | null>(null);

  // 外部值变化时同步本地输入（如从任务编辑回填、快捷尺寸点击）
  useEffect(() => {
    if (parsed) {
      setWidthInput(String(parsed.width));
      setHeightInput(String(parsed.height));
    }
  }, [parsed]);

  const widthNum = Number(widthInput);
  const heightNum = Number(heightInput);
  const info = useMemo(
    () => getGPTImage2SizeInfo(widthNum, heightNum),
    [widthNum, heightNum]
  );

  // 预览方块尺寸（按比例缩放到 PREVIEW_MAX）
  const previewBox = useMemo(() => {
    const w = widthNum > 0 ? widthNum : 1;
    const h = heightNum > 0 ? heightNum : 1;
    const longest = Math.max(w, h);
    return {
      width: Math.max(Math.round((w / longest) * PREVIEW_MAX), 8),
      height: Math.max(Math.round((h / longest) * PREVIEW_MAX), 8),
    };
  }, [widthNum, heightNum]);

  // 提交：吸附到合法尺寸并向上汇报；若被调整则给出提示
  const commit = useCallback(
    (rawW: number, rawH: number) => {
      const snapped = snapToValidGPTImage2Size(rawW, rawH);
      const changed =
        snapped.width !== Math.round(rawW) ||
        snapped.height !== Math.round(rawH);
      setWidthInput(String(snapped.width));
      setHeightInput(String(snapped.height));
      setSnapNotice(
        changed
          ? t(
              language,
              `已调整为合法尺寸 ${snapped.width}×${snapped.height}`,
              `Adjusted to ${snapped.width}×${snapped.height}`
            )
          : null
      );
      onChange(`${snapped.width}x${snapped.height}`, { keepOpen: true });
    },
    [language, onChange]
  );

  const handleSwap = useCallback(() => {
    setSnapNotice(null);
    setWidthInput(heightInput);
    setHeightInput(widthInput);
    onChange(`${heightInput}x${widthInput}`, { keepOpen: true });
  }, [widthInput, heightInput, onChange]);

  const handleQuickSize = useCallback(
    (quick: string) => {
      const p = parseGPTImage2PixelSize(quick);
      if (!p) return;
      setSnapNotice(null);
      setWidthInput(String(p.width));
      setHeightInput(String(p.height));
      onChange(quick, { keepOpen: true });
    },
    [onChange]
  );

  const tierLabel = info.tier.toUpperCase();
  const ratioText = info.ratioLabel;
  const mpText = `${info.megaPixels.toFixed(2)} MP`;

  return (
    <div
      className="gpt-image-custom-size"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="gpt-image-custom-size__inputs">
        <label className="gpt-image-custom-size__field">
          <span className="gpt-image-custom-size__field-label">
            {t(language, '宽', 'W')}
          </span>
          <input
            type="number"
            inputMode="numeric"
            className="gpt-image-custom-size__input"
            value={widthInput}
            min={GPT_IMAGE_2_SIZE_STEP}
            max={GPT_IMAGE_2_MAX_LONG_EDGE}
            step={GPT_IMAGE_2_SIZE_STEP}
            onChange={(e) => setWidthInput(e.target.value)}
            onBlur={() => commit(Number(widthInput), Number(heightInput))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                commit(Number(widthInput), Number(heightInput));
              }
            }}
          />
          <span className="gpt-image-custom-size__unit">px</span>
        </label>

        <HoverTip
          content={t(language, '交换宽高', 'Swap')}
          showArrow={false}
        >
          <button
            type="button"
            className="gpt-image-custom-size__swap"
            onClick={handleSwap}
          >
            <ArrowLeftRight size={14} />
          </button>
        </HoverTip>

        <label className="gpt-image-custom-size__field">
          <span className="gpt-image-custom-size__field-label">
            {t(language, '高', 'H')}
          </span>
          <input
            type="number"
            inputMode="numeric"
            className="gpt-image-custom-size__input"
            value={heightInput}
            min={GPT_IMAGE_2_SIZE_STEP}
            max={GPT_IMAGE_2_MAX_LONG_EDGE}
            step={GPT_IMAGE_2_SIZE_STEP}
            onChange={(e) => setHeightInput(e.target.value)}
            onBlur={() => commit(Number(widthInput), Number(heightInput))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                commit(Number(widthInput), Number(heightInput));
              }
            }}
          />
          <span className="gpt-image-custom-size__unit">px</span>
        </label>
      </div>

      <div className="gpt-image-custom-size__visual">
        <div className="gpt-image-custom-size__preview-wrap">
          <div
            className="gpt-image-custom-size__preview"
            style={{ width: previewBox.width, height: previewBox.height }}
          />
        </div>
        <div className="gpt-image-custom-size__readout">
          <span className="gpt-image-custom-size__ratio">{ratioText}</span>
          <span className="gpt-image-custom-size__meta">{mpText}</span>
          <span className="gpt-image-custom-size__meta">
            {t(language, `≈ ${tierLabel} 档`, `≈ ${tierLabel}`)}
          </span>
          {info.valid ? (
            <span className="gpt-image-custom-size__valid">
              <Check size={12} />
              {t(language, '符合要求', 'Valid')}
            </span>
          ) : (
            <span className="gpt-image-custom-size__invalid">
              <AlertTriangle size={12} />
              {t(language, '失焦后自动校正', 'Auto-fix on blur')}
            </span>
          )}
        </div>
      </div>

      {snapNotice && (
        <div className="gpt-image-custom-size__notice">{snapNotice}</div>
      )}

      <div className="gpt-image-custom-size__quick">
        {QUICK_SIZES.map((q) => {
          const isActive = value === q.value;
          return (
            <button
              key={q.value}
              type="button"
              className={`gpt-image-custom-size__quick-chip ${
                isActive ? 'gpt-image-custom-size__quick-chip--active' : ''
              }`}
              onClick={() => handleQuickSize(q.value)}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GptImageCustomSizeEditor;
