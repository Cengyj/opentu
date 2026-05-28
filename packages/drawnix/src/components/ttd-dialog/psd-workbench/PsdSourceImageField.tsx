import React, { useCallback, useRef, useState } from 'react';
import {
  FileImage,
  FolderOpen,
  ImagePlus,
  Replace,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAssets } from '../../../contexts/AssetContext';
import type { ReferenceImage } from '../shared';
import { MediaLibraryModal } from '../../media-library/MediaLibraryModal';
import {
  AssetSource,
  AssetType,
  SelectionMode,
  type Asset,
} from '../../../types/asset.types';
import { useAssets } from '../../../contexts/AssetContext';
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

function blobToReferenceImage(
  blob: Blob,
  name: string
): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function PsdSourceImageField({
  uiLanguage,
  images,
  disabled = false,
  onImagesChange,
  onError,
}: PsdSourceImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAsset } = useAssets();
  const [isDragging, setIsDragging] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [isImportingLocalImage, setIsImportingLocalImage] = useState(false);
  const [isImportingLibraryImage, setIsImportingLibraryImage] = useState(false);
  const sourceImage = images[0] ?? null;
  const isBusy = isImportingLocalImage || isImportingLibraryImage;

  const labels =
    uiLanguage === 'zh'
      ? {
          invalidFile: '请上传图片文件',
          fileTooLarge: '源图不能超过 25MB',
          loadFailed: '源图读取失败',
          loadingSource: '正在载入源图',
          pick: '载入源图',
          library: '从素材库选择',
          libraryShort: '素材库',
          importingLibrary: '正在载入素材',
          replace: '替换源图',
          remove: '移除源图',
          drop: '松开以载入 PSD 源图',
          emptyTitle: '拖入或选择一张源图',
          emptyHint: '用于 CHAT 图层分析；这里只保留 1 张 PSD 分层参考图。',
          loaded: '源图已载入',
          localOnly: '本地源图',
        }
      : {
          invalidFile: 'Please upload an image file',
          fileTooLarge: 'Source image must be under 25MB',
          loadFailed: 'Failed to read source image',
          loadingSource: 'Loading source',
          pick: 'Load source',
          library: 'Select from library',
          libraryShort: 'Library',
          importingLibrary: 'Loading asset',
          replace: 'Replace source',
          remove: 'Remove source',
          drop: 'Drop to load PSD source',
          emptyTitle: 'Drop or choose one source image',
          emptyHint:
            'Used for the CHAT layer analysis; this brief keeps one PSD layering reference.',
          loaded: 'Source loaded',
          localOnly: 'Local source',
        };

  const openFilePicker = useCallback(() => {
    if (!disabled && !isBusy) {
      fileInputRef.current?.click();
    }
  }, [disabled, isBusy]);

  const openMediaLibrary = useCallback(() => {
    if (!disabled && !isBusy) {
      setIsMediaLibraryOpen(true);
    }
  }, [disabled, isBusy]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled || isBusy) return;
      if (!file.type.startsWith('image/')) {
        onError?.(labels.invalidFile);
        return;
      }
      if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        onError?.(labels.fileTooLarge);
        return;
      }
      setIsImportingLocalImage(true);
      try {
        const image = await fileToReferenceImage(file);
        await addAsset(
          file,
          AssetType.IMAGE,
          AssetSource.LOCAL,
          file.name
        ).catch((error) => {
          console.warn(
            '[PsdSourceImageField] Failed to add source image to library:',
            error
          );
        });
        onImagesChange([image]);
        onError?.(null);
        void addAsset(
          file,
          AssetType.IMAGE,
          AssetSource.LOCAL,
          file.name
        ).catch((error) => {
          console.warn(
            '[PsdSourceImageField] Failed to add local source to asset library:',
            error
          );
        });
      } catch (error) {
        console.error(
          '[PsdSourceImageField] Failed to read source image:',
          error
        );
        onError?.(labels.loadFailed);
      } finally {
        setIsImportingLocalImage(false);
      }
    },
    [
      addAsset,
      disabled,
      isBusy,
      labels.fileTooLarge,
      labels.invalidFile,
      labels.loadFailed,
      onError,
      onImagesChange,
    ]
  );

  const openMediaLibrary = useCallback(() => {
    if (!disabled) {
      setShowMediaLibrary(true);
    }
  }, [disabled]);

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

  const handleLibrarySelect = useCallback(
    async (asset: Asset) => {
      if (disabled || isImportingLibraryImage) return;
      setIsImportingLibraryImage(true);
      try {
        const image = asset.url.startsWith('data:image/')
          ? { url: asset.url, name: asset.name }
          : await blobToReferenceImage(
              await (await fetch(asset.url)).blob(),
              asset.name
            );
        onImagesChange([image]);
        onError?.(null);
        setIsMediaLibraryOpen(false);
      } catch (error) {
        console.error(
          '[PsdSourceImageField] Failed to load media library asset:',
          error
        );
        onError?.(labels.loadFailed);
      } finally {
        setIsImportingLibraryImage(false);
      }
    },
    [
      disabled,
      isImportingLibraryImage,
      labels.loadFailed,
      onError,
      onImagesChange,
    ]
  );

  return (
    <>
      <div
        className={`psd-source-field${
          isDragging ? ' psd-source-field--dragging' : ''
        }${disabled ? ' psd-source-field--disabled' : ''}${
          isBusy ? ' psd-source-field--loading' : ''
        }`}
        aria-busy={isBusy}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !isBusy) setIsDragging(true);
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
          disabled={disabled || isBusy}
          onChange={handleInputChange}
        />

        {isImportingLocalImage ? (
          <div className="psd-source-field__loading" role="status">
            <UploadCloud size={18} /> {labels.importing}
          </div>
        ) : null}

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
                  : labels.localOnly}
              </small>
            </div>
            <div className="psd-source-field__actions">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={disabled || isBusy}
              >
                <Replace size={13} /> {labels.replace}
              </button>
              <button
                type="button"
                onClick={openMediaLibrary}
                disabled={disabled || isBusy}
              >
                <Images size={13} />{' '}
                {isImportingLibraryImage
                  ? labels.importingLibrary
                  : isImportingLocalImage
                  ? labels.loadingSource
                  : labels.libraryShort}
              </button>
              <button
                type="button"
                onClick={() => onImagesChange([])}
                disabled={disabled || isBusy}
              >
                <X size={13} /> {labels.remove}
              </button>
            </div>
          </>
        ) : (
          <div className="psd-source-field__empty-group">
            <button
              type="button"
              className="psd-source-field__empty"
              onClick={openFilePicker}
              disabled={disabled || isBusy}
            >
              <span className="psd-source-field__icon">
                {isDragging ? (
                  <UploadCloud size={22} />
                ) : (
                  <ImagePlus size={22} />
                )}
              </span>
              <strong>{isDragging ? labels.drop : labels.emptyTitle}</strong>
              <small>{labels.emptyHint}</small>
              <em>{labels.pick}</em>
            </button>
            <button
              type="button"
              className="psd-source-field__library"
              onClick={openMediaLibrary}
              disabled={disabled || isBusy}
            >
              <Images size={14} />
              {isImportingLibraryImage
                ? labels.importingLibrary
                : isImportingLocalImage
                ? labels.loadingSource
                : labels.library}
            </button>
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
