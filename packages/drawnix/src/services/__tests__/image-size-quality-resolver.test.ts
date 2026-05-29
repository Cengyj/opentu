import { describe, expect, it } from 'vitest';
import {
  getGPTImage2SizeInfo,
  isAcceptableSizeValue,
  isValidGPTImage2PixelSize,
  parseGPTImage2PixelSize,
  snapToValidGPTImage2Size,
  GPT_IMAGE_2_MAX_LONG_EDGE,
  GPT_IMAGE_2_MAX_PIXELS,
  GPT_IMAGE_2_MIN_PIXELS,
} from '../model-adapters/image-size-quality-resolver';

describe('image-size-quality-resolver custom size helpers', () => {
  describe('isValidGPTImage2PixelSize', () => {
    it('accepts official-style sizes', () => {
      expect(isValidGPTImage2PixelSize(1536, 1024)).toBe(true);
      expect(isValidGPTImage2PixelSize(2048, 2048)).toBe(true);
      expect(isValidGPTImage2PixelSize(3840, 2160)).toBe(true);
    });

    it('rejects non-multiples of 16', () => {
      expect(isValidGPTImage2PixelSize(1500, 1024)).toBe(false);
    });

    it('rejects long edge over 3840', () => {
      expect(isValidGPTImage2PixelSize(4096, 1024)).toBe(false);
    });

    it('rejects edge ratio over 3:1', () => {
      // 2048x640 -> 3.2:1
      expect(isValidGPTImage2PixelSize(2048, 640)).toBe(false);
    });

    it('rejects sizes below and above the pixel budget', () => {
      expect(isValidGPTImage2PixelSize(512, 512)).toBe(false); // < 0.66MP
      expect(isValidGPTImage2PixelSize(3840, 3840)).toBe(false); // > 8.29MP
    });
  });

  describe('snapToValidGPTImage2Size', () => {
    const expectValid = (w: number, h: number) => {
      const snapped = snapToValidGPTImage2Size(w, h);
      expect(snapped.width % 16).toBe(0);
      expect(snapped.height % 16).toBe(0);
      expect(isValidGPTImage2PixelSize(snapped.width, snapped.height)).toBe(
        true
      );
      return snapped;
    };

    it('snaps non-multiples of 16 to a valid size', () => {
      expectValid(1500, 1000);
    });

    it('clamps an oversized long edge and stays valid', () => {
      const snapped = expectValid(5000, 3000);
      expect(snapped.width).toBeLessThanOrEqual(GPT_IMAGE_2_MAX_LONG_EDGE);
      expect(snapped.height).toBeLessThanOrEqual(GPT_IMAGE_2_MAX_LONG_EDGE);
    });

    it('tightens an extreme aspect ratio to within 3:1', () => {
      const snapped = expectValid(3000, 500);
      const ratio =
        Math.max(snapped.width, snapped.height) /
        Math.min(snapped.width, snapped.height);
      expect(ratio).toBeLessThanOrEqual(3);
    });

    it('scales a too-small size up into the valid pixel budget', () => {
      const snapped = expectValid(320, 320);
      expect(snapped.width * snapped.height).toBeGreaterThanOrEqual(
        GPT_IMAGE_2_MIN_PIXELS
      );
    });

    it('scales a too-large square down under the pixel cap', () => {
      const snapped = expectValid(3840, 3840);
      expect(snapped.width * snapped.height).toBeLessThanOrEqual(
        GPT_IMAGE_2_MAX_PIXELS
      );
    });

    it('handles invalid/zero input without throwing', () => {
      expectValid(0, 0);
      expectValid(NaN, NaN);
    });
  });

  describe('parseGPTImage2PixelSize', () => {
    it('parses pixel strings case-insensitively', () => {
      expect(parseGPTImage2PixelSize('1536x1024')).toEqual({
        width: 1536,
        height: 1024,
      });
      expect(parseGPTImage2PixelSize('1536X1024')).toEqual({
        width: 1536,
        height: 1024,
      });
    });

    it('returns undefined for non-pixel values', () => {
      expect(parseGPTImage2PixelSize('auto')).toBeUndefined();
      expect(parseGPTImage2PixelSize('16x9')).toEqual({ width: 16, height: 9 });
      expect(parseGPTImage2PixelSize(undefined)).toBeUndefined();
      expect(parseGPTImage2PixelSize(1024 as unknown)).toBeUndefined();
    });
  });

  describe('getGPTImage2SizeInfo', () => {
    it('computes ratio, megapixels and tier', () => {
      const info = getGPTImage2SizeInfo(1536, 1024);
      expect(info.ratioLabel).toBe('3:2');
      expect(info.megaPixels).toBeCloseTo(1.57, 1);
      expect(info.valid).toBe(true);
    });

    it('flags invalid sizes', () => {
      expect(getGPTImage2SizeInfo(1500, 1000).valid).toBe(false);
    });
  });

  describe('isAcceptableSizeValue', () => {
    const sizeParam = {
      options: [{ value: 'auto' }, { value: '16x9' }],
      allowCustomPixelSize: true,
    };

    it('accepts values in the options list', () => {
      expect(isAcceptableSizeValue(sizeParam, 'auto')).toBe(true);
      expect(isAcceptableSizeValue(sizeParam, '16x9')).toBe(true);
    });

    it('accepts valid custom pixel sizes when allowed', () => {
      expect(isAcceptableSizeValue(sizeParam, '1536x1024')).toBe(true);
    });

    it('rejects invalid custom pixel sizes', () => {
      expect(isAcceptableSizeValue(sizeParam, '1500x1000')).toBe(false);
      expect(isAcceptableSizeValue(sizeParam, 'custom')).toBe(false);
    });

    it('rejects custom pixel sizes when the flag is off', () => {
      const noCustom = { options: [{ value: 'auto' }] };
      expect(isAcceptableSizeValue(noCustom, '1536x1024')).toBe(false);
    });

    it('handles missing param/value', () => {
      expect(isAcceptableSizeValue(undefined, '1536x1024')).toBe(false);
      expect(isAcceptableSizeValue(sizeParam, undefined)).toBe(false);
    });
  });
});
