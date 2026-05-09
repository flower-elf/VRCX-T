import { userProfileRepository } from '@/repositories/index.js';
import i18n from '@/services/i18nService.js';
import { useNotificationStore } from '@/state/notificationStore.js';
import { useRuntimeStore } from '@/state/runtimeStore.js';

const DEFAULT_MIN_STATUS_WRITE_INTERVAL_MS = 60_000;
const DEFAULT_MIN_DESCRIPTION_WRITE_INTERVAL_MS = 60_000;
const DEFAULT_STABLE_LOCATION_MS = 30_000;
const MAX_AUDIT_LOGS = 50;

const auditLogs = [];
const writeStates = new Map();
const timeRestoreSnapshots = {};

function createWriteState() {
    return {
        lastStatusWriteAtMs: 0,
        lastDescriptionWriteAtMs: 0,
        lastStatusValue: '',
        lastDescriptionValue: '',
        nextAllowedAtMs: 0,
        retryAfterMs: 0,
        lastError: ''
    };
}

function getWriteState(scopeKey) {
    if (!writeStates.has(scopeKey)) {
        writeStates.set(scopeKey, createWriteState());
    }
    return writeStates.get(scopeKey);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function addAuditLog(entry) {
    auditLogs.unshift({
        createdAt: new Date().toISOString(),
        ...entry
    });
    auditLogs.splice(MAX_AUDIT_LOGS);
}

function getChangedPatch(currentUser, patch) {
    const changed = {};
    if (hasOwn(patch, 'status') && currentUser?.status !== patch.status) {
        changed.status = patch.status;
    }
    if (
        hasOwn(patch, 'statusDescription') &&
        currentUser?.statusDescription !== patch.statusDescription
    ) {
        changed.statusDescription = patch.statusDescription;
    }
    return changed;
}

function getCurrentFieldValue(currentUser, field) {
    return String(currentUser?.[field] ?? '');
}

function getAutomationScopeKey(facts) {
    return `${facts?.endpoint || ''}:${facts?.currentUserId || ''}`;
}

function isCurrentAuthScope(facts) {
    const auth = useRuntimeStore.getState().auth || {};
    return (
        String(auth.currentUserEndpoint || '') === String(facts?.endpoint || '') &&
        String(auth.currentUserId || '') === String(facts?.currentUserId || '')
    );
}

function pruneRestoreSnapshotsForScope(scopeKey) {
    for (const [field, snapshot] of Object.entries(timeRestoreSnapshots)) {
        if (snapshot.scopeKey !== scopeKey) {
            delete timeRestoreSnapshots[field];
        }
    }
}

function getTimeOwnedFields(result) {
    const fields = new Set();
    for (const rule of result?.matchedRules || []) {
        if (rule?.domain !== 'time') {
            continue;
        }
        for (const field of rule.ownedFields || []) {
            if (field === 'status' || field === 'statusDescription') {
                fields.add(field);
            }
        }
    }
    return fields;
}

function getLocationScopedFields(result) {
    const fields = new Set();
    for (const rule of result?.matchedRules || []) {
        if (rule?.domain === 'time') {
            continue;
        }
        for (const field of rule.ownedFields || []) {
            fields.add(field);
        }
    }
    return fields;
}

function hasLocationScopedChanges(result, changedPatch) {
    const locationScopedFields = getLocationScopedFields(result);
    return Object.keys(changedPatch || {}).some((field) =>
        locationScopedFields.has(field)
    );
}

function buildPatchWithTimeRestore(currentUser, result, scopeKey) {
    const patch = { ...(result?.patch || {}) };
    const timeOwnedFields = getTimeOwnedFields(result);
    const pendingRestores = [];

    for (const field of timeOwnedFields) {
        if (!hasOwn(timeRestoreSnapshots, field)) {
            timeRestoreSnapshots[field] = {
                scopeKey,
                previousValue: getCurrentFieldValue(currentUser, field),
                automatedValue: String(patch[field] ?? '')
            };
            continue;
        }
        if (timeRestoreSnapshots[field].scopeKey !== scopeKey) {
            timeRestoreSnapshots[field] = {
                scopeKey,
                previousValue: getCurrentFieldValue(currentUser, field),
                automatedValue: String(patch[field] ?? '')
            };
            continue;
        }
        timeRestoreSnapshots[field].automatedValue = String(patch[field] ?? '');
    }

    for (const [field, snapshot] of Object.entries(timeRestoreSnapshots)) {
        if (snapshot.scopeKey !== scopeKey) {
            continue;
        }
        if (timeOwnedFields.has(field)) {
            continue;
        }
        if (
            !hasOwn(patch, field) &&
            getCurrentFieldValue(currentUser, field) === snapshot.automatedValue
        ) {
            patch[field] = snapshot.previousValue;
            pendingRestores.push(field);
        } else {
            pendingRestores.push(field);
        }
    }

    return { patch, pendingRestores };
}

function completeTimeRestores(fields) {
    for (const field of fields || []) {
        delete timeRestoreSnapshots[field];
    }
}

function parseDateMs(value) {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRetryAfterMs(error) {
    const retryAfter =
        error?.headers?.get?.('retry-after') ||
        error?.response?.headers?.['retry-after'] ||
        error?.retryAfter;
    const seconds = Number.parseInt(String(retryAfter || ''), 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60000;
}

function shouldSkipForStableLocation(facts, stableLocationMs) {
    if (facts.isTraveling) {
        return 'traveling';
    }
    const startedAtMs = parseDateMs(facts.currentLocationStartedAt);
    if (
        startedAtMs &&
        Date.now() - startedAtMs < (stableLocationMs || DEFAULT_STABLE_LOCATION_MS)
    ) {
        return 'location-stabilizing';
    }
    return '';
}

function shouldSkipForThrottle(changedPatch, throttle, nowMs, state) {
    if (
        hasOwn(changedPatch, 'status') &&
        changedPatch.status === state.lastStatusValue &&
        nowMs - state.lastStatusWriteAtMs <
            (throttle.minStatusWriteIntervalMs ||
                DEFAULT_MIN_STATUS_WRITE_INTERVAL_MS)
    ) {
        return 'status-throttled';
    }
    if (
        hasOwn(changedPatch, 'statusDescription') &&
        changedPatch.statusDescription === state.lastDescriptionValue &&
        nowMs - state.lastDescriptionWriteAtMs <
            (throttle.minDescriptionWriteIntervalMs ||
                DEFAULT_MIN_DESCRIPTION_WRITE_INTERVAL_MS)
    ) {
        return 'description-throttled';
    }
    return '';
}

function updateWriteTimestamps(state, changedPatch, nowMs) {
    if (hasOwn(changedPatch, 'status')) {
        state.lastStatusWriteAtMs = nowMs;
        state.lastStatusValue = changedPatch.status;
    }
    if (hasOwn(changedPatch, 'statusDescription')) {
        state.lastDescriptionWriteAtMs = nowMs;
        state.lastDescriptionValue = changedPatch.statusDescription;
    }
}

export async function applyPresenceAutomationResult({
    facts,
    result,
    throttle = {}
}) {
    const currentUser = facts.currentUser;
    if (!facts.currentUserId || !facts.endpoint || !currentUser?.id) {
        addAuditLog({
            action: 'profile-update',
            skippedReason: 'missing-current-user',
            patch: result?.patch || {}
        });
        return { applied: false, reason: 'missing-current-user' };
    }

    const scopeKey = getAutomationScopeKey(facts);
    const writeState = getWriteState(scopeKey);
    pruneRestoreSnapshotsForScope(scopeKey);
    const { patch: effectivePatch, pendingRestores } =
        buildPatchWithTimeRestore(currentUser, result, scopeKey);
    const changedPatch = getChangedPatch(currentUser, effectivePatch);
    if (!Object.keys(changedPatch).length) {
        completeTimeRestores(pendingRestores);
        return { applied: false, reason: 'no-change' };
    }

    const stableReason = hasLocationScopedChanges(result, changedPatch)
        ? shouldSkipForStableLocation(facts, throttle.stableLocationMs)
        : '';
    if (stableReason) {
        addAuditLog({
            action: 'profile-update',
            skippedReason: stableReason,
            patch: changedPatch,
            matchedRules: result?.matchedRules || []
        });
        return { applied: false, reason: stableReason };
    }

    const nowMs = Date.now();
    if (nowMs < writeState.nextAllowedAtMs) {
        addAuditLog({
            action: 'profile-update',
            skippedReason: 'backoff',
            patch: changedPatch,
            matchedRules: result?.matchedRules || [],
            error: writeState.lastError
        });
        return { applied: false, reason: 'backoff' };
    }

    const throttleReason = shouldSkipForThrottle(
        changedPatch,
        throttle,
        nowMs,
        writeState
    );
    if (throttleReason) {
        addAuditLog({
            action: 'profile-update',
            skippedReason: throttleReason,
            patch: changedPatch,
            matchedRules: result?.matchedRules || []
        });
        return { applied: false, reason: throttleReason };
    }

    if (!isCurrentAuthScope(facts)) {
        addAuditLog({
            action: 'profile-update',
            skippedReason: 'auth-context-changed',
            patch: changedPatch,
            matchedRules: result?.matchedRules || []
        });
        return { applied: false, reason: 'auth-context-changed' };
    }

    try {
        const updatedUser = await userProfileRepository.updateCurrentUser({
            userId: currentUser.id,
            endpoint: facts.endpoint,
            params: changedPatch
        });
        updateWriteTimestamps(writeState, changedPatch, nowMs);
        writeState.lastError = '';
        writeState.nextAllowedAtMs = 0;
        if (!isCurrentAuthScope(facts)) {
            addAuditLog({
                action: 'profile-update',
                patch: changedPatch,
                matchedRules: result?.matchedRules || [],
                note: 'auth-context-changed-after-write'
            });
            completeTimeRestores(pendingRestores);
            return {
                applied: true,
                patch: changedPatch,
                reason: 'auth-context-changed-after-write'
            };
        }
        useRuntimeStore.getState().setAuthBootstrap({
            currentUserSnapshot: {
                ...currentUser,
                ...updatedUser
            }
        });
        useNotificationStore.getState().pushNotification({
            level: 'info',
            title: i18n.t(
                'service.background_maintenance.generated.status_automatically_changed'
            ),
            message: [changedPatch.status, changedPatch.statusDescription]
                .filter((value) => value !== undefined && value !== '')
                .join(' / ')
        });
        addAuditLog({
            action: 'profile-update',
            patch: changedPatch,
            matchedRules: result?.matchedRules || []
        });
        completeTimeRestores(pendingRestores);
        return { applied: true, patch: changedPatch };
    } catch (error) {
        const retryAfterMs = getRetryAfterMs(error);
        writeState.retryAfterMs = retryAfterMs;
        writeState.nextAllowedAtMs = Date.now() + retryAfterMs;
        writeState.lastError =
            error instanceof Error ? error.message : String(error);
        addAuditLog({
            action: 'profile-update',
            patch: changedPatch,
            matchedRules: result?.matchedRules || [],
            error: writeState.lastError
        });
        return {
            applied: false,
            reason: 'error',
            error
        };
    }
}

export function resetPresenceAutomationExecutor() {
    auditLogs.length = 0;
    for (const key of Object.keys(timeRestoreSnapshots)) {
        delete timeRestoreSnapshots[key];
    }
    writeStates.clear();
}
