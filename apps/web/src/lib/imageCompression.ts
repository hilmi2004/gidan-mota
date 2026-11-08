/**
 * Compresses an image file on the client before upload (max 1280px width, WebP 0.82 quality)
 * and computes a 16-char perceptual hash for duplicate image detection.
 */
export async function compressImageClientSide(file: File): Promise<{
  dataUrl: string;
  perceptualHash: string;
  width: number;
  height: number;
  compressedBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const maxWidth = 1280;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Compute 8x8 luminance dHash for duplicate detection
        const hashCanvas = document.createElement('canvas');
        hashCanvas.width = 9;
        hashCanvas.height = 8;
        const hCtx = hashCanvas.getContext('2d');
        let bits = '';
        if (hCtx) {
          hCtx.drawImage(img, 0, 0, 9, 8);
          const pixels = hCtx.getImageData(0, 0, 9, 8).data;
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const leftIdx = (y * 9 + x) * 4;
              const rightIdx = (y * 9 + x + 1) * 4;
              const leftLum =
                (pixels[leftIdx] ?? 0) * 0.299 +
                (pixels[leftIdx + 1] ?? 0) * 0.587 +
                (pixels[leftIdx + 2] ?? 0) * 0.114;
              const rightLum =
                (pixels[rightIdx] ?? 0) * 0.299 +
                (pixels[rightIdx + 1] ?? 0) * 0.587 +
                (pixels[rightIdx + 2] ?? 0) * 0.114;
              bits += leftLum > rightLum ? '1' : '0';
            }
          }
        }
        const perceptualHash =
          bits.length === 64
            ? BigInt(`0b${bits}`).toString(16).padStart(16, '0')
            : `phash_${Date.now()}`;

        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        resolve({
          dataUrl,
          perceptualHash,
          width,
          height,
          compressedBytes: Math.round((dataUrl.length * 3) / 4),
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

