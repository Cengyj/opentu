import React, { useCallback, useRef, useState } from 'react';
import {
  FileImage,
  FolderOpen,
  ImagePlus,
  Replace,
  UploadCloud,
  X,
} from 'lucide-react';
import { MediaLibraryModal } from '../../media-library/MediaLibraryModal';
import {
  AssetType,
  SelectionMode,
  type Asset,
} from '../../../types/asset.types';
import type { ReferenceImage } from '../shared';

interface PsdSourceImageFieldProps {
  uiLanguage: 'zh' | 'en';
  images: ReferenceImage[];
  disabled?: boolean;
  onImagesChange: (images: ReferenceImage[]) => void;
  onError?: (message: string | null) => void;
}

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name: file.name,
        file,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isLibraryAssetUrl(url: string): boolean {
  return !url.startsWith('data:') && !url.startsWith('blob:');
}

export function PsdSourceImageField({
  uiLanguage,
  images,
  disabled = false,
  onImagesChange,
  onError,
}: PsdSourceImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const sourceImage = images[0] ?? null;

  const labels =
    uiLanguage === 'zh'
      ? {
          invalidFile: '请上传图片文件',
          fileTooLarge: '源图不能超过 25MB',
          loadFailed: '源图读取失败',
          pick: '本地载入',
          pickFromLibrary: '从素材库导入',
          replaceFromLibrary: '素材库替换',
          replace: '替换源图',
          remove: '移除源图',
          drop: '松开以载入 PSD 源图',
          emptyTitle: '建立 PSD 源图上下文',
          emptyHint: '上传、拖拽、粘贴，或从素材库/媒体库导入一张分层参考图。',
          loaded: '源图已载入',
          localOnly: '本地源图',
          libraryOnly: '素材库源图',
          librarySelectText: '作为 PSD 源图',
        }
      : {
          invalidFile: 'Please upload an image file',
          fileTooLarge: 'Source image must be under 25MB',
          loadFailed: 'Failed to read source image',
          pick: 'Load local',
          pickFromLibrary: 'Import from library',
          replaceFromLibrary: 'Replace from library',
          replace: 'Replace source',
          remove: 'Remove source',
          drop: 'Drop to load PSD source',
          emptyTitle: 'Build the PSD source context',
          emptyHint:
            'Upload, drop, paste, or import one layering reference from the media library.',
          loaded: 'Source loaded',
          localOnly: 'Local source',
          libraryOnly: 'Library source',
          librarySelectText: 'Use as PSD source',
        };

  const openFilePicker = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const openMediaLibrary = useCallback(() => {
    if (!disabled) setShowMediaLibrary(true);
  }, [disabled]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      if (!file.type.startsWith('image/')) {
        onError?.(labels.invalidFile);
        return;
      }
      if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        onError?.(labels.fileTooLarge);
        return;
      }
      try {
        const image = await fileToReferenceImage(file);
        onImagesChange([image]);
        onError?.(null);
      } catch (error) {
        console.error(
          '[PsdSourceImageField] Failed to read source image:',
          error
        );
        onError?.(labels.loadFailed);
      }
    },
    [
      disabled,
      labels.fileTooLarge,
      labels.invalidFile,
      labels.loadFailed,
      onError,
      onImagesChange,
    ]
  );

  const handleMediaLibrarySelect = useCallback(
    (asset: Asset) => {
      if (disabled) return;
      if (asset.type !== AssetType.IMAGE || !asset.url) {
        onError?.(labels.invalidFile);
        return;
      }

      onImagesChange([
        {
          url: asset.url,
          name: asset.name || `asset-${asset.id}`,
        },
      ]);
      onError?.(null);
      setShowMediaLibrary(false);
    },
    [disabled, labels.invalidFile, onError, onImagesChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void handleFile(event.target.files?.[0]);
      event.target.value = '';
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      void handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedImage = Array.from(event.clipboardData.files).find((file) =>
        file.type.startsWith('image/')
      );
      if (pastedImage) {
        event.preventDefault();
        void handleFile(pastedImage);
      }
    },
    [handleFile]
  );

  return (
    <>
      <div
        className={`psd-source-field${
          isDragging ? ' psd-source-field--dragging' : ''
        }${disabled ? ' psd-source-field--disabled' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={disabled ? -1 : 0}
        aria-label={
          uiLanguage === 'zh' ? 'PSD 源图上传区' : 'PSD source image uploader'
        }
      >
        <input
          ref={fileInputRef}
          className="psd-source-field__input"
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={handleInputChange}
        />

        {sourceImage ? (
          <>
            <div className="psd-source-field__preview-wrap">
              <img
                src={sourceImage.url}
                alt={sourceImage.name}
                className="psd-source-field__preview"
              />
            </div>
            <div className="psd-source-field__meta">
              <span className="psd-source-field__status">
                <FileImage size={13} /> {labels.loaded}
              </span>
              <strong title={sourceImage.name}>{sourceImage.name}</strong>
              <small>
                {sourceImage.file
                  ? formatFileSize(sourceImage.file.size)
                  : isLibraryAssetUrl(sourceImage.url)
                  ? labels.libraryOnly
                  : labels.localOnly}
              </small>
            </div>
            <div className="psd-source-field__actions">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={disabled}
              >
                <Replace size={13} /> {labels.replace}
              </button>
              <button
                type="button"
                onClick={openMediaLibrary}
                disabled={disabled}
              >
                <FolderOpen size={13} /> {labels.replaceFromLibrary}
              </button>
              <button
                type="button"
                onClick={() => onImagesChange([])}
                disabled={disabled}
              >
                <X size={13} /> {labels.remove}
              </button>
            </div>
          </>
        ) : (
          <div className="psd-source-field__empty">
            <span className="psd-source-field__icon">
              {isDragging ? <UploadCloud size={22} /> : <ImagePlus size={22} />}
            </span>
            <strong>{isDragging ? labels.drop : labels.emptyTitle}</strong>
            <small>{labels.emptyHint}</small>
            <div className="psd-source-field__empty-actions">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={disabled}
              >
                <ImagePlus size={13} /> {labels.pick}
              </button>
              <button
                type="button"
                onClick={openMediaLibrary}
                disabled={disabled}
              >
                <FolderOpen size={13} /> {labels.pickFromLibrary}
              </button>
            </div>
          </div>
        )}
      </div>

      {showMediaLibrary ? (
        <MediaLibraryModal
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          mode={SelectionMode.SELECT}
          filterType={AssetType.IMAGE}
          onSelect={handleMediaLibrarySelect}
          selectButtonText={labels.librarySelectText}
        />
      ) : null}
    </>
  );
}
