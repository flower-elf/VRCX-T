import { describe, expect, it } from 'vitest';

import {
    buildSessionsFromEvents,
    clipSessionsToRange,
    buildOverlapBuckets,
    mergeSessions,
    ONLINE_SESSION_MERGE_GAP_MS
} from './activityEngine';

const T = (offsetMs: number) => 1_700_000_000_000 + offsetMs;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('buildSessionsFromEvents', () => {
    it('returns empty sessions and null pending for empty input', () => {
        const result = buildSessionsFromEvents([]);
        expect(result.sessions).toEqual([]);
        expect(result.pendingSessionStartAt).toBeNull();
    });

    it('produces one session from an Online/Offline pair', () => {
        const events = [
            { created_at: new Date(T(0)).toISOString(), type: 'Online' },
            { created_at: new Date(T(HOUR)).toISOString(), type: 'Offline' }
        ];
        const result = buildSessionsFromEvents(events);
        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0]).toMatchObject({ start: T(0), end: T(HOUR) });
        expect(result.pendingSessionStartAt).toBeNull();
    });

    it('leaves a pending session when Online has no matching Offline', () => {
        const events = [
            { created_at: new Date(T(0)).toISOString(), type: 'Online' }
        ];
        const result = buildSessionsFromEvents(events);
        expect(result.sessions).toHaveLength(0);
        expect(result.pendingSessionStartAt).toBe(T(0));
    });

    it('closes the previous session when a second Online event appears', () => {
        const events = [
            { created_at: new Date(T(0)).toISOString(), type: 'Online' },
            { created_at: new Date(T(HOUR)).toISOString(), type: 'Online' }
        ];
        const result = buildSessionsFromEvents(events);
        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0]).toMatchObject({ start: T(0), end: T(HOUR) });
        expect(result.pendingSessionStartAt).toBe(T(HOUR));
    });

    it('respects an initialStart for an already-open session', () => {
        const events = [
            { created_at: new Date(T(HOUR)).toISOString(), type: 'Offline' }
        ];
        const result = buildSessionsFromEvents(events, T(0));
        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0]).toMatchObject({ start: T(0), end: T(HOUR) });
    });
});

describe('mergeSessions', () => {
    it('returns empty array for empty inputs', () => {
        expect(mergeSessions([], [])).toEqual([]);
    });

    it('preserves non-overlapping separate sessions', () => {
        const older = [{ start: T(0), end: T(HOUR) }];
        const newer = [{ start: T(3 * HOUR), end: T(4 * HOUR) }];
        const result = mergeSessions(older, newer);
        expect(result).toHaveLength(2);
    });

    it('merges overlapping sessions into one', () => {
        const a = [{ start: T(0), end: T(2 * HOUR) }];
        const b = [{ start: T(HOUR), end: T(3 * HOUR) }];
        const result = mergeSessions(a, b);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ start: T(0), end: T(3 * HOUR) });
    });

    it('merges sessions within the default gap', () => {
        const gap = ONLINE_SESSION_MERGE_GAP_MS;
        const a = [{ start: T(0), end: T(HOUR) }];
        const b = [{ start: T(HOUR) + gap - MIN, end: T(2 * HOUR) + gap }];
        const result = mergeSessions(a, b);
        expect(result).toHaveLength(1);
    });

    it('keeps sessions apart when gap exceeds mergeGapMs', () => {
        const gap = ONLINE_SESSION_MERGE_GAP_MS;
        const a = [{ start: T(0), end: T(HOUR) }];
        const b = [{ start: T(HOUR) + gap + MIN, end: T(2 * HOUR) + gap }];
        const result = mergeSessions(a, b);
        expect(result).toHaveLength(2);
    });

    it('preserves isOpenTail from either merged session', () => {
        const a = [{ start: T(0), end: T(2 * HOUR), isOpenTail: true }];
        const b = [{ start: T(HOUR), end: T(3 * HOUR) }];
        const result = mergeSessions(a, b);
        expect(result[0].isOpenTail).toBe(true);
    });
});

describe('clipSessionsToRange', () => {
    const rangeStart = T(0);
    const rangeEnd = T(4 * HOUR);

    it('returns empty array for empty input', () => {
        expect(clipSessionsToRange([], rangeStart, rangeEnd)).toEqual([]);
    });

    it('keeps sessions fully within the range unchanged', () => {
        const sessions = [{ start: T(HOUR), end: T(2 * HOUR) }];
        const result = clipSessionsToRange(sessions, rangeStart, rangeEnd);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ start: T(HOUR), end: T(2 * HOUR) });
    });

    it('clips sessions that partially overlap the range', () => {
        const sessions = [{ start: T(-HOUR), end: T(2 * HOUR) }];
        const result = clipSessionsToRange(sessions, rangeStart, rangeEnd);
        expect(result).toHaveLength(1);
        expect(result[0].start).toBe(rangeStart);
        expect(result[0].end).toBe(T(2 * HOUR));
    });

    it('removes sessions fully outside the range', () => {
        const before = [{ start: T(-2 * HOUR), end: T(-HOUR) }];
        const after = [{ start: T(5 * HOUR), end: T(6 * HOUR) }];
        expect(clipSessionsToRange(before, rangeStart, rangeEnd)).toHaveLength(
            0
        );
        expect(clipSessionsToRange(after, rangeStart, rangeEnd)).toHaveLength(
            0
        );
    });
});

describe('buildOverlapBuckets', () => {
    const windowStart = T(0);
    const now = T(7 * 24 * HOUR);

    it('returns 168 zero buckets when there is no overlap', () => {
        const self = [{ start: T(0), end: T(HOUR) }];
        const target = [{ start: T(2 * HOUR), end: T(3 * HOUR) }];
        const buckets = buildOverlapBuckets(self, target, windowStart, now);
        expect(buckets).toHaveLength(168);
        expect(buckets.every((v) => v === 0)).toBe(true);
    });

    it('returns non-zero buckets when sessions overlap', () => {
        const self = [{ start: T(0), end: T(2 * HOUR) }];
        const target = [{ start: T(HOUR), end: T(3 * HOUR) }];
        const buckets = buildOverlapBuckets(self, target, windowStart, now);
        expect(buckets.some((v) => v > 0)).toBe(true);
    });

    it('returns 168 zero buckets for empty inputs', () => {
        const buckets = buildOverlapBuckets([], [], windowStart, now);
        expect(buckets).toHaveLength(168);
        expect(buckets.every((v) => v === 0)).toBe(true);
    });

    it('overlap cannot exceed the shorter of the two session sets', () => {
        const self = [{ start: T(0), end: T(HOUR) }];
        const target = [{ start: T(0), end: T(2 * HOUR) }];
        const overlapBuckets = buildOverlapBuckets(
            self,
            target,
            windowStart,
            now
        );
        const overlapTotal = overlapBuckets.reduce((s, v) => s + v, 0);
        expect(overlapTotal).toBeLessThanOrEqual(60);
    });
});
