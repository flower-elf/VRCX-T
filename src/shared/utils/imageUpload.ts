import { bytesToBase64 } from './binary';

export interface ImageUploadValidationOptions {
    maxSize?: number;
}

export type ImageUploadValidationResult =
    | { ok: true; reason: '' }
    | { ok: false; reason: 'missing' | 'too_large' | 'not_image' };

export interface ImageCropOptions {
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
}

export interface ImageCropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const UPLOAD_TIMEOUT_MS = 30_000;
export const MAX_IMAGE_UPLOAD_BYTES = 20_000_000;
export const IMAGE_UPLOAD_ACCEPT =
    'image/png,image/jpeg,image/webp,image/gif,image/bmp';

const SAFE_RASTER_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/bmp'
]);

/**
 *
 */
export function withUploadTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_: any, reject: any) => {
        timeoutId = setTimeout(
            () => reject(new Error('Upload timed out')),
            UPLOAD_TIMEOUT_MS
        );
    });
    return Promise.race<T>([promise, timeout]).finally(() => {
        clearTimeout(timeoutId);
    });
}

export async function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer());
}

/**
 * File -> base64
 */
export async function readFileAsBase64(blob: Blob): Promise<string> {
    return bytesToBase64(await readBlobAsBytes(blob));
}

export function validateImageUploadFile(
    file: Blob | File | null | undefined,
    { maxSize = MAX_IMAGE_UPLOAD_BYTES }: ImageUploadValidationOptions = {}
): ImageUploadValidationResult {
    if (!file) {
        return { ok: false, reason: 'missing' };
    }

    if (file.size >= maxSize) {
        return { ok: false, reason: 'too_large' };
    }

    if (!SAFE_RASTER_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
        return { ok: false, reason: 'not_image' };
    }

    return { ok: true, reason: '' };
}

export async function cropImageFileToAspect(
    file: File,
    aspectRatio: number,
    options: ImageCropOptions = {}
): Promise<Blob> {
    if (!validateImageUploadFile(file).ok) {
        throw new Error('Selected file is not a supported image.');
    }

    if (!aspectRatio || typeof document === 'undefined') {
        return file;
    }
    if (typeof createImageBitmap !== 'function') {
        throw new Error('Image decoding is not supported.');
    }

    const image = await createImageBitmap(file);
    try {
        const crop = computeAspectCrop(
            image.width,
            image.height,
            aspectRatio,
            options
        );

        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to prepare image crop.');
        }
        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height
        );
        return await new Promise((resolve: any, reject: any) => {
            canvas.toBlob((blob: any) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to crop image.'));
                }
            }, 'image/png');
        });
    } finally {
        image.close();
    }
}

export function computeAspectCrop(
    width: number,
    height: number,
    aspectRatio: number,
    options: ImageCropOptions = {}
): ImageCropRect {
    const sourceAspect = width / height;
    let baseWidth = width;
    let baseHeight = height;

    if (sourceAspect > aspectRatio) {
        baseWidth = Math.round(baseHeight * aspectRatio);
    } else if (sourceAspect < aspectRatio) {
        baseHeight = Math.round(baseWidth / aspectRatio);
    }

    const zoom = Math.min(3, Math.max(1, Number(options.zoom) || 1));
    const cropWidth = Math.max(1, Math.round(baseWidth / zoom));
    const cropHeight = Math.max(1, Math.round(baseHeight / zoom));
    const maxX = Math.max(0, width - cropWidth);
    const maxY = Math.max(0, height - cropHeight);
    const offsetX = Math.min(1, Math.max(-1, Number(options.offsetX) || 0));
    const offsetY = Math.min(1, Math.max(-1, Number(options.offsetY) || 0));
    const x = Math.round(maxX / 2 + (offsetX * maxX) / 2);
    const y = Math.round(maxY / 2 + (offsetY * maxY) / 2);

    return {
        x: Math.min(maxX, Math.max(0, x)),
        y: Math.min(maxY, Math.max(0, y)),
        width: cropWidth,
        height: cropHeight
    };
}
