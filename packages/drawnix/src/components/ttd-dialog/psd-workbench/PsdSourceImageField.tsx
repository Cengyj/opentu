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

function blobToReferenceImage(blob: Blob, name: string): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name,
        file: blob instanceof File ? blob : undefined,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
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
  const { addAsset } = useAssets();
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isImportingLocalImage, setIsImportingLocalImage] = useState(false);
  const [isImportingLibraryImage, setIsImportingLibraryImage] = useState(false);
  const sourceImage = images[0] ?? null;
  const isBusy = isImportingLocalImage || isImportingLibraryImage;
  const isDisabled = disabled || isBusy;

  const labels =
    uiLanguage === 'zh'
      ? {
          invalidFile: '请上传图片文件',
          fileTooLarge: '源图不能超过 25MB',
          loadFailed: '源图读取失败',
          pick: '载入源图',
          pickFromLibrary: '从素材库选择源图',
          replaceFromLibrary: '素材库替换',
          replace: '替换源图',
          remove: '移除源图',
          drop: '松开以载入 PSD 源图',
          emptyTitle: '拖入、粘贴或选择一张源图',
          emptyHint: '用于 CHAT 图层分析；这里只保留 1 张 PSD 分层参考图。',
          loaded: '源图已载入',
          importing: '正在载入源图…',
          importingLibrary: '正在载入素材…',
          localOnly: '本地源图',
          libraryOnly: '素材库源图',
          librarySelectText: '作为 PSD 源图',
        }
      : {
          invalidFile: 'Please upload an image file',
          fileTooLarge: 'Source image must be under 25MB',
          loadFailed: 'Failed to read source image',
          pick: 'Load source',
          pickFromLibrary: 'Select source from library',
          replaceFromLibrary: 'Replace from library',
          replace: 'Replace source',
          remove: 'Remove source',
          drop: 'Drop to load PSD source',
          emptyTitle: 'Drop, paste, or choose one source image',
          emptyHint:
            'Used for the CHAT layer analysis; this brief keeps one PSD layering reference.',
          loaded: 'Source loaded',
          importing: 'Loading source…',
          importingLibrary: 'Loading library asset…',
          localOnly: 'Local source',
          libraryOnly: 'Library source',
          librarySelectText: 'Use as PSD source',
        };

  const openFilePicker = useCallback(() => {
    if (!isDisabled) fileInputRef.current?.click();
  }, [isDisabled]);

  const openMediaLibrary = useCallback(() => {
    if (!isDisabled) setShowMediaLibrary(true);
  }, [isDisabled]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || isDisabled) return;
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
        const image = await blobToReferenceImage(file, file.name);
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
      isDisabled,
      labels.fileTooLarge,
      labels.invalidFile,
      labels.loadFailed,
      onError,
      onImagesChange,
    ]
  );

  const handleMediaLibrarySelect = useCallback(
    async (asset: Asset) => {
      if (isDisabled) return;
      if (asset.type !== AssetType.IMAGE || !asset.url) {
        onError?.(labels.invalidFile);
        return;
      }

      setIsImportingLibraryImage(true);
      try {
        const image = asset.url.startsWith('data:image/')
          ? { url: asset.url, name: asset.name || `asset-${asset.id}` }
          : await blobToReferenceImage(
              await (await fetch(asset.url)).blob(),
              asset.name || `asset-${asset.id}`
            );
        onImagesChange([image]);
        onError?.(null);
        setShowMediaLibrary(false);
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
    [isDisabled, labels.invalidFile, labels.loadFailed, onError, onImagesChange]
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
        }${disabled ? ' psd-source-field--disabled' : ''}${
          isBusy ? ' psd-source-field--loading' : ''
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isDisabled) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={isDisabled ? -1 : 0}
        aria-busy={isBusy}
        aria-label={
          uiLanguage === 'zh' ? 'PSD 源图上传区' : 'PSD source image uploader'
        }
      >
        <input
          ref={fileInputRef}
          className="psd-source-field__input"
          type="file"
          accept="image/*"
          disabled={isDisabled}
          onChange={handleInputChange}
        />

        {isBusy ? (
          <div className="psd-source-field__loading" role="status">
            <UploadCloud size={18} />
            {isImportingLibraryImage ? labels.importingLibrary : labels.importing}
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
                  : isLibraryAssetUrl(sourceImage.url)
                  ? labels.libraryOnly
                  : labels.localOnly}
              </small>
            </div>
            <div className="psd-source-field__actions">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isDisabled}
              >
                <Replace size={13} /> {labels.replace}
              </button>
              <button
                type="button"
                onClick={openMediaLibrary}
                disabled={isDisabled}
              >
                <FolderOpen size={13} /> {labels.replaceFromLibrary}
              </button>
              <button
                type="button"
                onClick={() => onImagesChange([])}
                disabled={isDisabled}
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
              disabled={isDisabled}
            >
              <span className="psd-source-field__icon">
                {isDragging ? <UploadCloud size={22} /> : <ImagePlus size={22} />}
              </span>
              <strong>{isDragging ? labels.drop : labels.emptyTitle}</strong>
              <small>{labels.emptyHint}</small>
              <em>{labels.pick}</em>
            </button>
            <button
              type="button"
              className="psd-source-field__library"
              onClick={openMediaLibrary}
              disabled={isDisabled}
            >
              <FolderOpen size={14} /> {labels.pickFromLibrary}
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
          onSelect={(asset) => void handleMediaLibrarySelect(asset)}
          selectButtonText={labels.librarySelectText}
        />
      ) : null}
    </>
  );
}
