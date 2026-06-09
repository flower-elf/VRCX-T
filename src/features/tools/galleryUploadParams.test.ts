import { describe, expect, it } from 'vitest';

import {
    buildPrintUploadParams,
    resolvePrintCropWhiteBorder
} from './galleryUploadParams';

describe('galleryUploadParams', () => {
    it('builds print upload params from the image crop note', () => {
        expect(
            buildPrintUploadParams({
                note: 'print-specific note',
                timestamp: '2026-06-09T10:11:12'
            })
        ).toEqual({
            note: 'print-specific note',
            timestamp: '2026-06-09T10:11:12'
        });
    });

    it('limits print upload notes to 32 characters', () => {
        expect(
            buildPrintUploadParams({
                note: '123456789012345678901234567890123',
                timestamp: '2026-06-09T10:11:12'
            }).note
        ).toBe('12345678901234567890123456789012');
    });

    it('defaults print white-border cropping on when the dialog does not provide a value', () => {
        expect(resolvePrintCropWhiteBorder(undefined)).toBe(true);
    });

    it('uses the per-upload print white-border crop option from the dialog', () => {
        expect(resolvePrintCropWhiteBorder(false)).toBe(false);
    });
});
