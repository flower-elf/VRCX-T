import { tauriClient } from '@/platform/tauri/client';
import configRepository from '@/repositories/configRepository';
import friendLogRepository from '@/repositories/friendLogRepository';
import {
    computeTrustLevel,
    computeUserPlatform
} from '@/shared/utils/userTransforms';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useSessionStore } from '@/state/sessionStore';

import { recordFriendPatch } from './domainIngestionService';
import { syncStartupServicesTask } from './startupServicesStatus';
import { notifyRuntimeVrchatAuthFailure } from './vrchatAuthErrorService';

const activeBootstraps = new Map<string, Promise<unknown>>();
const friendLogMutationQueues = new Map<string, Promise<unknown>>();
const explicitFriendLogAddIntents = new Map<string, symbol>();
const explicitFriendLogAddIntentsHandledByBootstrap = new Set<string>();

function normalizeUserId(value: unknown) {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function normalizeStateBucket(value: unknown) {
    const normalized = normalizeUserId(value).toLowerCase();
    if (
        normalized === 'online' ||
        normalized === 'active' ||
        normalized === 'offline'
    ) {
        return normalized;
    }
    return '';
}

function getDisplayName(user: Record<string, any> | null | undefined) {
    return user?.displayName || user?.username || user?.id || '';
}

function getMeaningfulDisplayName(
    user: Record<string, any> | null | undefined,
    userId: any = ''
) {
    const normalizedUserId = normalizeUserId(userId || user?.id);
    for (const candidate of [user?.displayName, user?.username]) {
        const displayName = normalizeUserId(candidate);
        if (displayName && displayName !== normalizedUserId) {
            return displayName;
        }
    }
    return '';
}

function enqueueFriendLogMutation(userId: unknown, mutation: () => unknown) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        return Promise.reject(
            new Error('Friend log mutation requires a current user id.')
        );
    }

    const previous =
        friendLogMutationQueues.get(normalizedUserId) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(mutation);
    let queued;
    queued = run
        .catch(() => {})
        .finally(() => {
            if (friendLogMutationQueues.get(normalizedUserId) === queued) {
                friendLogMutationQueues.delete(normalizedUserId);
            }
        });
    friendLogMutationQueues.set(normalizedUserId, queued);
    return run;
}

function getExplicitFriendLogAddIntentKey(
    currentUserId: any,
    targetUserId: any
) {
    const normalizedCurrentUserId = normalizeUserId(currentUserId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);
    if (
        !normalizedCurrentUserId ||
        !normalizedTargetUserId ||
        normalizedCurrentUserId === normalizedTargetUserId
    ) {
        return '';
    }
    return `${normalizedCurrentUserId}\u0000${normalizedTargetUserId}`;
}

export function registerFriendLogExplicitAddIntent({
    currentUserId,
    targetUserId
}: any) {
    const key = getExplicitFriendLogAddIntentKey(currentUserId, targetUserId);
    if (!key) {
        return () => {};
    }

    const token = Symbol('friend-log-explicit-add');
    explicitFriendLogAddIntents.set(key, token);
    return () => {
        if (explicitFriendLogAddIntents.get(key) === token) {
            explicitFriendLogAddIntents.delete(key);
            explicitFriendLogAddIntentsHandledByBootstrap.delete(key);
        }
    };
}

function getExplicitFriendLogAddIntentUserIds(currentUserId: any) {
    const normalizedCurrentUserId = normalizeUserId(currentUserId);
    if (!normalizedCurrentUserId) {
        return [];
    }

    const prefix = `${normalizedCurrentUserId}\u0000`;
    return Array.from(explicitFriendLogAddIntents.keys())
        .filter((key: any) => key.startsWith(prefix))
        .map((key: any) => normalizeUserId(key.slice(prefix.length)))
        .filter(Boolean);
}

function markExplicitFriendLogAddIntentsHandledByBootstrap(
    currentUserId: any,
    targetUserIds: any
) {
    const normalizedCurrentUserId = normalizeUserId(currentUserId);
    if (!normalizedCurrentUserId || !Array.isArray(targetUserIds)) {
        return;
    }

    for (const targetUserId of targetUserIds) {
        const key = getExplicitFriendLogAddIntentKey(
            normalizedCurrentUserId,
            targetUserId
        );
        if (key && explicitFriendLogAddIntents.has(key)) {
            explicitFriendLogAddIntentsHandledByBootstrap.add(key);
        }
    }
}

function consumeExplicitFriendLogAddIntentHandledByBootstrap(
    currentUserId: any,
    targetUserId: any
) {
    const key = getExplicitFriendLogAddIntentKey(currentUserId, targetUserId);
    if (!key || !explicitFriendLogAddIntentsHandledByBootstrap.has(key)) {
        return false;
    }

    explicitFriendLogAddIntentsHandledByBootstrap.delete(key);
    return true;
}

function addStateBucketIds(stateById: any, ids: any, state: any) {
    if (!Array.isArray(ids)) {
        return;
    }

    for (const value of ids) {
        const userId = normalizeUserId(value);
        if (!userId) {
            continue;
        }
        stateById.set(userId, state);
    }
}

function buildFriendStateMap(currentUserSnapshot: any) {
    const stateById = new Map();
    addStateBucketIds(stateById, currentUserSnapshot?.friends, 'offline');
    addStateBucketIds(
        stateById,
        currentUserSnapshot?.offlineFriends,
        'offline'
    );
    addStateBucketIds(stateById, currentUserSnapshot?.activeFriends, 'active');
    addStateBucketIds(stateById, currentUserSnapshot?.onlineFriends, 'online');

    return stateById;
}

function hasCompleteFriendStateSnapshot(currentUserSnapshot: any) {
    return (
        Array.isArray(currentUserSnapshot?.friends) &&
        Array.isArray(currentUserSnapshot?.offlineFriends) &&
        Array.isArray(currentUserSnapshot?.activeFriends) &&
        Array.isArray(currentUserSnapshot?.onlineFriends)
    );
}

function resolveSnapshotStateBucket(stateBucket: any) {
    return normalizeStateBucket(stateBucket) || 'offline';
}

function buildUnfriendHistoryEntry(
    row: Record<string, any>,
    createdAt: string
) {
    const userId = normalizeUserId(row?.userId);
    if (!userId) {
        return null;
    }

    return {
        created_at: createdAt,
        type: 'Unfriend',
        userId,
        displayName: row?.displayName || userId,
        friendNumber: row?.friendNumber ?? row?.$friendNumber ?? null
    };
}

function buildFriendHistoryEntry(row: Record<string, any>, createdAt: string) {
    const userId = normalizeUserId(row?.userId || row?.id);
    if (!userId) {
        return null;
    }

    return {
        created_at: createdAt,
        type: 'Friend',
        userId,
        displayName: row?.displayName || row?.username || userId,
        trustLevel: row?.trustLevel ?? row?.$trustLevel ?? '',
        friendNumber: row?.friendNumber ?? row?.$friendNumber ?? null
    };
}

function getFriendLogInitKey(userId: string) {
    return `friendLogInit_${userId}`;
}

function parseVrchatResponseData(response: any) {
    const data = response?.data;
    if (typeof data !== 'string') {
        return data && typeof data === 'object' ? data : null;
    }

    try {
        const parsed = JSON.parse(data);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function isValidUserProfile(value: any) {
    return Boolean(
        value && typeof value === 'object' && normalizeUserId(value.id)
    );
}

function bulkFriendStateInput(friend: Record<string, any> | null | undefined) {
    const platform = normalizeUserId(friend?.platform);
    if (platform === 'web') {
        return 'active';
    }
    if (platform) {
        return 'online';
    }
    return 'offline';
}

function friendNeedsSupplementalFetch(
    friend: Record<string, any> | null | undefined,
    snapshotStateBucket: string
) {
    if (!friend || typeof friend !== 'object') {
        return true;
    }
    if (normalizeUserId(friend.$profileSource) === 'placeholder') {
        return true;
    }
    const currentState = resolveSnapshotStateBucket(snapshotStateBucket);
    return (
        currentState !== bulkFriendStateInput(friend) ||
        normalizeUserId(friend.location) === 'traveling'
    );
}

function buildCurrentEntryFromFriend({
    userId,
    friend,
    friendNumber
}: {
    userId: string;
    friend: Record<string, any> | null | undefined;
    friendNumber: number;
}) {
    const trustLevel =
        normalizeUserId(friend?.$trustLevel || friend?.trustLevel) || 'Visitor';
    return {
        userId,
        displayName: getDisplayName(friend) || userId,
        trustLevel,
        friendNumber
    };
}

export async function recordFriendLogFriendByUserId({
    currentUserId,
    targetUserId,
    targetUser,
    stateBucket,
    nowIso = () => new Date().toJSON()
}: any): Promise<any> {
    const normalizedCurrentUserId = normalizeUserId(currentUserId);
    const normalizedTargetUserId = normalizeUserId(
        targetUserId || targetUser?.id
    );
    if (
        !normalizedCurrentUserId ||
        !normalizedTargetUserId ||
        normalizedCurrentUserId === normalizedTargetUserId
    ) {
        return {
            userId: normalizedCurrentUserId,
            targetUserId: normalizedTargetUserId,
            count: 0,
            inserted: false,
            historyCount: 0
        };
    }

    return enqueueFriendLogMutation(normalizedCurrentUserId, async () => {
        const explicitAddIntentKey = getExplicitFriendLogAddIntentKey(
            normalizedCurrentUserId,
            normalizedTargetUserId
        );
        const hasExplicitAddIntent =
            Boolean(explicitAddIntentKey) &&
            explicitFriendLogAddIntents.has(explicitAddIntentKey);
        const wasHandledByBootstrap =
            consumeExplicitFriendLogAddIntentHandledByBootstrap(
                normalizedCurrentUserId,
                normalizedTargetUserId
            );
        const existingRows = (await friendLogRepository.getFriendLogCurrent(
            normalizedCurrentUserId
        )) as Record<string, any>[];
        const existingRow = existingRows.find(
            (entry: any) =>
                normalizeUserId(entry?.userId) === normalizedTargetUserId
        );
        const maxFriendNumber = existingRows.reduce(
            (maxValue: any, row: any) => {
                const friendNumber =
                    Number.parseInt(
                        row?.friendNumber ?? row?.$friendNumber ?? 0,
                        10
                    ) || 0;
                return Math.max(maxValue, friendNumber);
            },
            0
        );
        const nextFriendNumber =
            Number.parseInt(
                targetUser?.friendNumber ??
                    targetUser?.$friendNumber ??
                    existingRow?.friendNumber ??
                    existingRow?.$friendNumber ??
                    0,
                10
            ) ||
            (maxFriendNumber > 0
                ? maxFriendNumber + 1
                : existingRows.length + 1);
        const source =
            targetUser && typeof targetUser === 'object'
                ? {
                      ...targetUser,
                      id: normalizedTargetUserId,
                      friendNumber: nextFriendNumber,
                      $friendNumber: nextFriendNumber
                  }
                : {
                      id: normalizedTargetUserId,
                      friendNumber: nextFriendNumber,
                      $friendNumber: nextFriendNumber
                  };
        const normalizedStateBucket =
            normalizeStateBucket(stateBucket) ||
            normalizeStateBucket(source.stateBucket) ||
            normalizeStateBucket(source.state) ||
            'offline';
        const normalizedFriend = normalizeFriendEntry(
            source,
            normalizedStateBucket,
            existingRow ?? {
                userId: normalizedTargetUserId,
                displayName: getDisplayName(source) || normalizedTargetUserId,
                trustLevel: 'Visitor',
                friendNumber: nextFriendNumber
            }
        );
        const currentEntry: any = {
            userId: normalizedTargetUserId,
            displayName: normalizedFriend.displayName,
            trustLevel: normalizedFriend.$trustLevel,
            friendNumber: normalizedFriend.$friendNumber
        };
        const historyEntry = buildFriendHistoryEntry(currentEntry, nowIso());

        const result = await friendLogRepository.upsertFriendLogCurrent(
            normalizedCurrentUserId,
            currentEntry,
            {
                historyEntry,
                forceHistory: hasExplicitAddIntent && wasHandledByBootstrap
            }
        );
        if (hasExplicitAddIntent) {
            explicitFriendLogAddIntents.delete(explicitAddIntentKey);
        }
        return result;
    });
}

export async function recordFriendLogUnfriendByUserId({
    currentUserId,
    targetUserId,
    nowIso = () => new Date().toJSON()
}: any) {
    const normalizedCurrentUserId = normalizeUserId(currentUserId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);
    if (!normalizedCurrentUserId || !normalizedTargetUserId) {
        return {
            userId: normalizedCurrentUserId,
            targetUserId: normalizedTargetUserId,
            removedCount: 0,
            historyCount: 0
        };
    }

    return enqueueFriendLogMutation(normalizedCurrentUserId, async () => {
        const existingRows = (await friendLogRepository.getFriendLogCurrent(
            normalizedCurrentUserId
        )) as Record<string, any>[];
        const row = existingRows.find(
            (entry: any) =>
                normalizeUserId(entry?.userId) === normalizedTargetUserId
        );
        const historyEntry = row
            ? buildUnfriendHistoryEntry(row, nowIso())
            : null;
        if (!historyEntry) {
            return {
                userId: normalizedCurrentUserId,
                targetUserId: normalizedTargetUserId,
                removedCount: 0,
                historyCount: 0
            };
        }

        const result = await friendLogRepository.deleteFriendLogCurrentArray(
            normalizedCurrentUserId,
            [normalizedTargetUserId],
            { historyEntries: [historyEntry] }
        );

        return {
            userId: normalizedCurrentUserId,
            targetUserId: normalizedTargetUserId,
            removedCount: result?.count ?? 0,
            historyCount: result?.historyCount ?? 0
        };
    });
}

function createFallbackFriendUser(
    userId: unknown,
    existingRow: Record<string, any>
) {
    return {
        id: userId,
        displayName: existingRow?.displayName || userId,
        username: '',
        tags: [],
        developerType: '',
        platform: 'offline',
        last_platform: '',
        location: 'offline',
        state: 'offline'
    };
}

function normalizeFriendEntry(
    friend: Record<string, any> | null | undefined,
    stateBucket: string,
    existingRow: Record<string, any>
) {
    const source =
        friend ?? createFallbackFriendUser(existingRow?.userId, existingRow);
    const sourceRecord = source as Record<string, any>;
    const tags = Array.isArray(sourceRecord.tags) ? sourceRecord.tags : [];
    const trust = computeTrustLevel(tags, sourceRecord.developerType || '');
    const explicitTrustLevel =
        sourceRecord.$trustLevel || sourceRecord.trustLevel || '';
    const hasTrustMetadata =
        Boolean(friend) &&
        (tags.length > 0 ||
            Boolean(sourceRecord.developerType) ||
            Boolean(explicitTrustLevel));
    const trustLevel =
        explicitTrustLevel ||
        (hasTrustMetadata
            ? trust.trustLevel
            : existingRow?.trustLevel || existingRow?.$trustLevel) ||
        trust.trustLevel;
    const friendNumber =
        Number.parseInt(
            sourceRecord?.friendNumber ??
                sourceRecord?.$friendNumber ??
                existingRow?.friendNumber ??
                existingRow?.$friendNumber ??
                0,
            10
        ) || 0;
    const displayName =
        getMeaningfulDisplayName(
            sourceRecord,
            sourceRecord.id || existingRow?.userId
        ) ||
        existingRow?.displayName ||
        getDisplayName(sourceRecord) ||
        sourceRecord.id;

    return {
        ...sourceRecord,
        displayName,
        state: stateBucket,
        stateBucket,
        friendNumber,
        trustLevel,
        $friendNumber: friendNumber,
        $trustLevel: trustLevel,
        $trustClass: trust.trustClass,
        $trustSortNum: trust.trustSortNum,
        $isModerator: trust.isModerator,
        $isTroll: trust.isTroll,
        $isProbableTroll: trust.isProbableTroll,
        $platform: computeUserPlatform(
            sourceRecord.platform,
            sourceRecord.last_platform
        )
    };
}

function buildFriendLogRowsById(rows: any[] = []) {
    const rowsById = new Map<string, Record<string, any>>();
    if (!Array.isArray(rows)) {
        return rowsById;
    }

    for (const row of rows) {
        const userId = normalizeUserId(row?.userId || row?.user_id);
        if (!userId) {
            continue;
        }
        rowsById.set(userId, row);
    }
    return rowsById;
}

function buildSeedRosterFriendsById(
    stateById: Map<string, string>,
    friendLogRows: any[] = []
) {
    const rowsById = buildFriendLogRowsById(friendLogRows);
    const friendsById: Record<string, any> = {};

    for (const [userId, stateBucket] of stateById.entries()) {
        const row = rowsById.get(userId) ?? {};
        const trustLevel = normalizeUserId(row?.trustLevel) || 'Visitor';
        const friendNumber =
            Number.parseInt(row?.friendNumber ?? row?.$friendNumber ?? 0, 10) ||
            0;
        const displayName = normalizeUserId(row?.displayName) || userId;
        friendsById[userId] = {
            id: userId,
            displayName,
            username: '',
            tags: [],
            developerType: '',
            platform: 'offline',
            last_platform: '',
            location: 'offline',
            state: stateBucket,
            stateBucket,
            trustLevel,
            $trustLevel: trustLevel,
            friendNumber,
            $friendNumber: friendNumber
        };
    }

    return friendsById;
}

async function seedFriendRosterFromCurrentUserSnapshot({
    normalizedUserId,
    endpoint,
    websocket,
    currentUserSnapshot,
    detail
}: {
    normalizedUserId: string;
    endpoint: string;
    websocket: string;
    currentUserSnapshot: any;
    detail: string;
}) {
    if (!hasCompleteFriendStateSnapshot(currentUserSnapshot)) {
        return false;
    }

    const stateById = buildFriendStateMap(currentUserSnapshot);
    let friendLogRows: any[] = [];
    try {
        friendLogRows = (await friendLogRepository.getFriendLogCurrent(
            normalizedUserId
        )) as any[];
    } catch (error) {
        console.warn('Failed to seed friend roster from friend log:', error);
    }

    if (!isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)) {
        return false;
    }

    useFriendRosterStore.getState().setRosterSeedSnapshot({
        currentUserId: normalizedUserId,
        friendsById: buildSeedRosterFriendsById(stateById, friendLogRows),
        detail
    });
    return true;
}

async function fetchSupplementalFriendProfile({
    normalizedUserId,
    endpoint,
    websocket,
    userId,
    stateBucket,
    detail
}: {
    normalizedUserId: string;
    endpoint: string;
    websocket: string;
    userId: string;
    stateBucket: string;
    detail: string;
}) {
    const response = await tauriClient.app.VrchatUserGet({
        endpoint,
        userId
    });
    const profile = parseVrchatResponseData(response);
    if (!isValidUserProfile(profile)) {
        return false;
    }
    if (!isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)) {
        return false;
    }

    const nextStateBucket = resolveSnapshotStateBucket(
        stateBucket || profile.stateBucket || profile.state
    );
    useFriendRosterStore.getState().applyFriendPatches(
        [
            {
                userId,
                stateBucket: nextStateBucket,
                patch: profile
            }
        ],
        detail
    );
    recordFriendPatch({
        endpoint,
        userId,
        stateBucket: nextStateBucket,
        patch: profile
    });
    return true;
}

async function runFriendRosterBackgroundSupplements({
    normalizedUserId,
    endpoint,
    websocket,
    currentUserSnapshot,
    fastFriendsById,
    detail
}: {
    normalizedUserId: string;
    endpoint: string;
    websocket: string;
    currentUserSnapshot: any;
    fastFriendsById: Record<string, any>;
    detail: string;
}) {
    if (!hasCompleteFriendStateSnapshot(currentUserSnapshot)) {
        return;
    }
    const stateById = buildFriendStateMap(currentUserSnapshot);
    const fetchIds = new Set<string>();
    for (const [userId, stateBucket] of stateById.entries()) {
        const friend = fastFriendsById[userId];
        if (friendNeedsSupplementalFetch(friend, stateBucket)) {
            fetchIds.add(userId);
        }
    }

    for (const userId of fetchIds) {
        if (!isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)) {
            return;
        }
        try {
            await fetchSupplementalFriendProfile({
                normalizedUserId,
                endpoint,
                websocket,
                userId,
                stateBucket: stateById.get(userId) || 'offline',
                detail
            });
        } catch (error) {
            console.warn('Failed to supplement friend profile:', error);
        }
    }
}

async function confirmRemovedFriend({
    endpoint,
    userId
}: {
    endpoint: string;
    userId: string;
}) {
    const response = await tauriClient.app.VrchatFriendStatusGet({
        endpoint,
        userId
    });
    const status = parseVrchatResponseData(response);
    return status?.isFriend === false;
}

async function runFriendLogStartupReconciliation({
    normalizedUserId,
    endpoint,
    websocket,
    currentUserSnapshot,
    fastFriendsById,
    nowIso = () => new Date().toJSON()
}: {
    normalizedUserId: string;
    endpoint: string;
    websocket: string;
    currentUserSnapshot: any;
    fastFriendsById: Record<string, any>;
    nowIso?: () => string;
}) {
    if (!Array.isArray(currentUserSnapshot?.friends)) {
        return;
    }

    await enqueueFriendLogMutation(normalizedUserId, async () => {
        const initialized = await configRepository.getBool(
            getFriendLogInitKey(normalizedUserId),
            false
        );
        const existingRows = (await friendLogRepository.getFriendLogCurrent(
            normalizedUserId
        )) as Record<string, any>[];
        if (!isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)) {
            return;
        }

        const existingRowsById = buildFriendLogRowsById(existingRows);
        const currentFriendIds = currentUserSnapshot.friends
            .map(normalizeUserId)
            .filter(Boolean);
        const currentFriendIdSet = new Set(currentFriendIds);
        const maxFriendNumber = existingRows.reduce((maxValue, row) => {
            const friendNumber =
                Number.parseInt(
                    row?.friendNumber ?? row?.$friendNumber ?? 0,
                    10
                ) || 0;
            return Math.max(maxValue, friendNumber);
        }, 0);
        let nextFriendNumber =
            maxFriendNumber > 0 ? maxFriendNumber + 1 : existingRows.length + 1;
        const explicitAddIntentUserIds = new Set(
            getExplicitFriendLogAddIntentUserIds(normalizedUserId)
        );

        if (!initialized) {
            const entries = currentFriendIds
                .filter((friendId) => friendId !== normalizedUserId)
                .map((friendId, index) =>
                    buildCurrentEntryFromFriend({
                        userId: friendId,
                        friend: fastFriendsById[friendId] || { id: friendId },
                        friendNumber: index + 1
                    })
                );
            if (
                !isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)
            ) {
                return;
            }
            await friendLogRepository.replaceFriendLogCurrent(
                normalizedUserId,
                entries,
                { historyEntries: [], addedHistoryEntries: [] }
            );
            for (const friendId of explicitAddIntentUserIds) {
                if (currentFriendIdSet.has(friendId)) {
                    markExplicitFriendLogAddIntentsHandledByBootstrap(
                        normalizedUserId,
                        [friendId]
                    );
                }
            }
            if (
                !isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)
            ) {
                return;
            }
            await configRepository.setBool(
                getFriendLogInitKey(normalizedUserId),
                true
            );
            return;
        }

        for (const friendId of currentFriendIds) {
            if (
                !isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)
            ) {
                return;
            }
            if (
                friendId === normalizedUserId ||
                existingRowsById.has(friendId)
            ) {
                continue;
            }
            const friend = fastFriendsById[friendId] || { id: friendId };
            const currentEntry = buildCurrentEntryFromFriend({
                userId: friendId,
                friend,
                friendNumber: nextFriendNumber++
            });
            const hasExplicitAddIntent = explicitAddIntentUserIds.has(friendId);
            const historyEntry =
                initialized && !hasExplicitAddIntent
                    ? buildFriendHistoryEntry(currentEntry, nowIso())
                    : null;
            await friendLogRepository.upsertFriendLogCurrent(
                normalizedUserId,
                currentEntry,
                historyEntry ? { historyEntry } : {}
            );
            if (hasExplicitAddIntent) {
                markExplicitFriendLogAddIntentsHandledByBootstrap(
                    normalizedUserId,
                    [friendId]
                );
            }
        }

        if (initialized) {
            for (const row of existingRows) {
                if (
                    !isCurrentBootstrapTarget(
                        normalizedUserId,
                        endpoint,
                        websocket
                    )
                ) {
                    return;
                }
                const friendId = normalizeUserId(row?.userId);
                if (
                    !friendId ||
                    friendId === normalizedUserId ||
                    currentFriendIdSet.has(friendId)
                ) {
                    continue;
                }
                let confirmedRemoved = false;
                try {
                    confirmedRemoved = await confirmRemovedFriend({
                        endpoint,
                        userId: friendId
                    });
                } catch (error) {
                    console.warn('Failed to confirm removed friend:', error);
                }
                if (
                    !confirmedRemoved ||
                    !isCurrentBootstrapTarget(
                        normalizedUserId,
                        endpoint,
                        websocket
                    )
                ) {
                    continue;
                }
                const historyEntry = buildUnfriendHistoryEntry(row, nowIso());
                if (!historyEntry) {
                    continue;
                }
                await friendLogRepository.deleteFriendLogCurrentArray(
                    normalizedUserId,
                    [friendId],
                    { historyEntries: [historyEntry] }
                );
            }
        }

        if (!isCurrentBootstrapTarget(normalizedUserId, endpoint, websocket)) {
            return;
        }
        await configRepository.setBool(
            getFriendLogInitKey(normalizedUserId),
            true
        );
    });
}

function startFriendRosterBackgroundTasks({
    normalizedUserId,
    endpoint,
    websocket,
    currentUserSnapshot,
    fastFriendsById,
    detail
}: {
    normalizedUserId: string;
    endpoint: string;
    websocket: string;
    currentUserSnapshot: any;
    fastFriendsById: Record<string, any>;
    detail: string;
}) {
    void runFriendRosterBackgroundSupplements({
        normalizedUserId,
        endpoint,
        websocket,
        currentUserSnapshot,
        fastFriendsById,
        detail
    }).catch((error) => {
        console.warn('Friend roster background supplement failed:', error);
    });
    void runFriendLogStartupReconciliation({
        normalizedUserId,
        endpoint,
        websocket,
        currentUserSnapshot,
        fastFriendsById
    }).catch((error) => {
        console.warn('Friend log startup reconciliation failed:', error);
    });
}

function bootstrapTargetKey(
    userId: any,
    endpoint: any = '',
    websocket: any = ''
) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedEndpoint = String(endpoint || '');
    const normalizedWebsocket = String(websocket || '');
    return `${normalizedUserId}\u0000${normalizedEndpoint}\u0000${normalizedWebsocket}`;
}

function isCurrentBootstrapTarget(
    userId: any,
    endpoint: any = '',
    websocket: any = null
) {
    const runtimeState = useRuntimeStore.getState();
    const sessionState = useSessionStore.getState();
    const expectedWebsocket =
        websocket === null ? null : String(websocket || '');

    return (
        runtimeState.auth.currentUserId === userId &&
        runtimeState.auth.currentUserEndpoint === String(endpoint || '') &&
        (expectedWebsocket === null ||
            runtimeState.auth.currentUserWebsocket === expectedWebsocket) &&
        sessionState.isLoggedIn &&
        sessionState.sessionPhase === 'ready'
    );
}

async function runFriendBootstrap({
    userId,
    endpoint = '',
    websocket = null,
    currentUserSnapshot,
    preserveLoadedState = false
}: any) {
    const normalizedUserId = normalizeUserId(userId || currentUserSnapshot?.id);
    if (!normalizedUserId) {
        throw new Error('Friend bootstrap requires an authenticated user id.');
    }
    const realtimeWebsocket = String(
        websocket ?? useRuntimeStore.getState().auth.currentUserWebsocket ?? ''
    );

    const displayName = getDisplayName(currentUserSnapshot) || normalizedUserId;

    useFriendRosterStore
        .getState()
        .setRosterLoading(
            normalizedUserId,
            `Loading the friend roster baseline for ${displayName}.`
        );
    useRuntimeStore
        .getState()
        .setStartupTask(
            'services',
            'running',
            `Loading the friend roster baseline for ${displayName}.`
        );
    if (!preserveLoadedState) {
        useSessionStore.getState().setFriendsLoaded(false);
        await seedFriendRosterFromCurrentUserSnapshot({
            normalizedUserId,
            endpoint,
            websocket: realtimeWebsocket,
            currentUserSnapshot,
            detail: `Loading the full friend roster baseline for ${displayName}.`
        });
    }

    const bootstrapResult = await tauriClient.app
        .SocialFriendRosterBaselineGet({
            userId: normalizedUserId,
            endpoint,
            websocket: realtimeWebsocket,
            currentUserSnapshot
        })
        .catch((error: any) => {
            notifyRuntimeVrchatAuthFailure(
                error,
                endpoint,
                'friend roster baseline'
            );
            throw error;
        });

    const result = bootstrapResult as Record<string, any>;
    const snapshot = result.snapshot as Record<string, any> | null | undefined;
    const detail = String(result.detail || snapshot?.detail || '');

    if (result.stale || !snapshot) {
        if (
            isCurrentBootstrapTarget(
                normalizedUserId,
                endpoint,
                realtimeWebsocket
            )
        ) {
            throw new Error(
                `Friend roster baseline was stale for ${normalizedUserId}.`
            );
        }

        return {
            userId: normalizedUserId,
            count: result.count ?? 0,
            detail,
            stale: true
        };
    }

    if (
        !isCurrentBootstrapTarget(normalizedUserId, endpoint, realtimeWebsocket)
    ) {
        return {
            userId: normalizedUserId,
            count: result.count ?? 0,
            detail,
            stale: true
        };
    }

    useFriendRosterStore.getState().setRosterSnapshot({
        currentUserId: normalizedUserId,
        friendsById: snapshot.friendsById || {},
        orderedFriendIds: snapshot.orderedFriendIds || [],
        onlineIds: snapshot.onlineIds || [],
        activeIds: snapshot.activeIds || [],
        offlineIds: snapshot.offlineIds || [],
        detail
    });
    useSessionStore.getState().setFriendsLoaded(true);
    syncStartupServicesTask([detail]);
    startFriendRosterBackgroundTasks({
        normalizedUserId,
        endpoint,
        websocket: realtimeWebsocket,
        currentUserSnapshot,
        fastFriendsById: snapshot.friendsById || {},
        detail
    });

    return {
        userId: normalizedUserId,
        count: result.count ?? 0,
        detail,
        stale: false
    };
}

export function bootstrapFriendRoster(options: any) {
    const normalizedUserId = normalizeUserId(
        options?.userId || options?.currentUserSnapshot?.id
    );
    const currentUserSnapshot =
        options?.currentUserSnapshot &&
        typeof options.currentUserSnapshot === 'object'
            ? options.currentUserSnapshot
            : null;
    const preserveLoadedState = Boolean(options?.preserveLoadedState);
    if (!normalizedUserId || !currentUserSnapshot) {
        return Promise.reject(
            new Error('Friend bootstrap requires an authenticated user id.')
        );
    }

    const activeKey = bootstrapTargetKey(
        normalizedUserId,
        options?.endpoint,
        options?.websocket ??
            useRuntimeStore.getState().auth.currentUserWebsocket
    );
    if (activeBootstraps.has(activeKey)) {
        return activeBootstraps.get(activeKey);
    }

    const promise = runFriendBootstrap(options)
        .catch((error: any) => {
            if (
                isCurrentBootstrapTarget(
                    normalizedUserId,
                    options?.endpoint,
                    options?.websocket ??
                        useRuntimeStore.getState().auth.currentUserWebsocket
                )
            ) {
                useFriendRosterStore
                    .getState()
                    .setRosterError(
                        error instanceof Error ? error.message : String(error)
                    );
                if (!preserveLoadedState) {
                    useSessionStore.getState().setFriendsLoaded(false);
                }
                useRuntimeStore
                    .getState()
                    .setStartupTask(
                        'services',
                        'error',
                        error instanceof Error ? error.message : String(error)
                    );
            }

            throw error;
        })
        .finally(() => {
            activeBootstraps.delete(activeKey);
        });

    activeBootstraps.set(activeKey, promise);
    return promise;
}
