const PRINT_UPLOAD_NOTE_MAX_LENGTH = 32;

export function resolvePrintCropWhiteBorder(cropWhiteBorder?: unknown) {
    return typeof cropWhiteBorder === 'boolean' ? cropWhiteBorder : true;
}

export function buildPrintUploadParams({
    note,
    timestamp
}: {
    note?: unknown;
    timestamp: string;
}) {
    return {
        note: String(note ?? '').slice(0, PRINT_UPLOAD_NOTE_MAX_LENGTH),
        timestamp
    };
}
