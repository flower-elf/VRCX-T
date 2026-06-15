export function sortRows(rows: any) {
    return rows.slice().sort((left: any, right: any) => {
        const leftTs = Date.parse(left?.created_at ?? '');
        const rightTs = Date.parse(right?.created_at ?? '');
        if (
            Number.isFinite(leftTs) &&
            Number.isFinite(rightTs) &&
            leftTs !== rightTs
        ) {
            return rightTs - leftTs;
        }

        const leftId = Number.parseInt(left?.rowId ?? 0, 10) || 0;
        const rightId = Number.parseInt(right?.rowId ?? 0, 10) || 0;
        return rightId - leftId;
    });
}

export function normalizeUserId(value: any) {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

export const UNKNOWN_FRIEND_LOG_DISPLAY_NAME = 'Unknown';

export function isUserIdLike(value: any) {
    return /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        normalizeUserId(value)
    );
}

// A row's displayName is "dirty" when older builds wrote the raw user id (or an empty value the UI
// then backfilled with the id) instead of a real name. Treat those as missing so the caller can
// resolve the real name from another source.
export function resolveDisplayNameCandidate(value: any, userId: any) {
    const normalized = normalizeUserId(value);
    if (
        !normalized ||
        normalized === normalizeUserId(userId) ||
        normalized === UNKNOWN_FRIEND_LOG_DISPLAY_NAME ||
        isUserIdLike(normalized)
    ) {
        return '';
    }
    return normalized;
}

export function getFriendLogRowKey(row: any, ownerUserId: any = '') {
    const owner = normalizeUserId(ownerUserId);
    const rowId = Number.parseInt(row?.rowId ?? 0, 10) || 0;
    if (rowId > 0) {
        return `${owner}:row:${rowId}`;
    }

    return `${owner}:composite:${row?.created_at || ''}:${row?.type || ''}:${row?.userId || ''}`;
}

export function matchesSearch(row: any, searchQuery: any) {
    if (!searchQuery) {
        return true;
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
        return true;
    }

    return String(row?.resolvedDisplayName ?? row?.displayName ?? '')
        .toLowerCase()
        .includes(query);
}
