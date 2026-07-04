'use client';

import { useRef, useState, useCallback } from 'react';

// ============================================================
// Image compression
// ============================================================

const MAX_DIMENSION = 1200; // px — keeps phone screenshots readable but lightweight
const JPEG_QUALITY = 0.75;

/**
 * Compress an image file to a base64 data URL.
 * Resizes so the longest edge ≤ MAX_DIMENSION.
 * JPEG output for photos/screenshots; falls back to PNG for small images.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only compress image files
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth, naturalHeight } = img;

      // If the image is already small enough, just read as-is
      if (naturalWidth <= MAX_DIMENSION && naturalHeight <= MAX_DIMENSION) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
        return;
      }

      // Calculate new dimensions preserving aspect ratio
      const scale = MAX_DIMENSION / Math.max(naturalWidth, naturalHeight);
      const width = Math.round(naturalWidth * scale);
      const height = Math.round(naturalHeight * scale);

      // Draw resized image onto canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer JPEG for photos/screenshots, PNG for images with transparency
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputType, JPEG_QUALITY);

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// ============================================================
// Component props
// ============================================================

type ScreenshotManagerProps = {
  /** Current base64 screenshot data (empty string = no screenshot). */
  screenshot: string;
  /** Called with the compressed base64 data URL after a file is selected. */
  onScreenshotChange: (base64: string) => void;
  /** Called when the user deletes the screenshot. */
  onScreenshotRemove: () => void;
};

// ============================================================
// Component
// ============================================================

export default function ScreenshotManager({
  screenshot,
  onScreenshotChange,
  onScreenshotRemove,
}: ScreenshotManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setCompressing(true);
      try {
        const compressed = await compressImage(file);
        onScreenshotChange(compressed);
      } catch {
        // Silently ignore — the user can retry
      } finally {
        setCompressing(false);
        // Reset so the same file can be re-selected (e.g. after delete → re-upload)
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onScreenshotChange],
  );

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ---------------------------------------------------------
  // Render: empty state
  // ---------------------------------------------------------

  if (!screenshot) {
    return (
      <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-100">Screenshot</p>
          <p className="text-xs text-slate-500">Required</p>
        </div>

        <button
          type="button"
          onClick={triggerUpload}
          disabled={compressing}
          className="flex h-28 w-full items-center justify-center rounded-[18px] border border-dashed border-slate-600 bg-slate-950/70 text-sm text-slate-400 transition hover:border-sky-500/60 hover:bg-slate-900/60 hover:text-slate-300 active:scale-[0.98]"
        >
          <span className="text-center">
            <span className="block text-2xl">
              {compressing ? '⏳' : '📷'}
            </span>
            <span className="mt-1 block">
              {compressing ? 'Processing...' : 'Upload Screenshot'}
            </span>
          </span>
        </button>

        <p className="mt-2 text-xs text-slate-500">
          {compressing ? 'Compressing image...' : 'No screenshot selected'}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload screenshot"
        />
      </div>
    );
  }

  // ---------------------------------------------------------
  // Render: has screenshot
  // ---------------------------------------------------------

  return (
    <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-100">Screenshot</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          ✓ Uploaded
        </span>
      </div>

      {/* Thumbnail preview */}
      <div className="overflow-hidden rounded-[18px] border border-slate-700 bg-slate-950/70">
        <img
          src={screenshot}
          alt="Screenshot preview"
          className="w-full object-cover"
          style={{ maxHeight: '260px' }}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={triggerUpload}
          disabled={compressing}
          className="rounded-[16px] border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50"
        >
          {compressing ? 'Processing...' : 'Replace'}
        </button>
        <button
          type="button"
          onClick={onScreenshotRemove}
          className="rounded-[16px] border border-red-700/50 bg-red-950/30 px-3 py-2.5 text-sm font-medium text-red-300 transition hover:border-red-600 hover:bg-red-950/50 active:scale-[0.98]"
        >
          Delete
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Replace screenshot"
      />
    </div>
  );
}
