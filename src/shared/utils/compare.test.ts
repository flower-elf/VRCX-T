import { describe, expect, it } from 'vitest';

import {
    compareByLastActive,
    compareByLastSeen,
    compareByLocationAt,
    compareByPrivate,
    compareByStatus
} from './compare';

describe('compareByStatus', () => {
    it('returns 0 when either ref is undefined', () => {
        expect(compareByStatus({}, {})).toBe(0);
        expect(compareByStatus({ ref: { status: 'active' } }, {})).toBe(0);
    });

    it('returns 0 for identical statuses', () => {
        const a = { ref: { state: 'online', status: 'active' } };
        const b = { ref: { state: 'online', status: 'active' } };
        expect(compareByStatus(a, b)).toBe(0);
    });

    it('sorts offline state last regardless of status value', () => {
        const offline = { ref: { state: 'offline', status: 'join me' } };
        const online = { ref: { state: 'online', status: 'busy' } };
        expect(compareByStatus(offline, online)).toBeGreaterThan(0);
    });

    it('orders by status priority when neither is offline state', () => {
        const joinMe = { ref: { state: 'online', status: 'join me' } };
        const busy = { ref: { state: 'online', status: 'busy' } };
        expect(compareByStatus(joinMe, busy)).toBeLessThan(0);
        expect(compareByStatus(busy, joinMe)).toBeGreaterThan(0);
    });
});

describe('compareByLastSeen', () => {
    it('returns 0 when ref is undefined', () => {
        expect(compareByLastSeen({}, {})).toBe(0);
    });

    it('sorts more recent $lastSeen first', () => {
        const earlier = { ref: { $lastSeen: '2024-01-01T00:00:00Z' } };
        const later = { ref: { $lastSeen: '2024-01-02T00:00:00Z' } };
        expect(compareByLastSeen(later, earlier)).toBeLessThan(0);
        expect(compareByLastSeen(earlier, later)).toBeGreaterThan(0);
    });

    it('returns 0 for equal $lastSeen', () => {
        const a = { ref: { $lastSeen: '2024-01-01T00:00:00Z' } };
        const b = { ref: { $lastSeen: '2024-01-01T00:00:00Z' } };
        expect(compareByLastSeen(a, b)).toBe(0);
    });

    it('sorts entry with empty $lastSeen before non-empty (active longest)', () => {
        const withDate = { ref: { $lastSeen: '2024-01-01T00:00:00Z' } };
        const noTimestamp = { ref: { $lastSeen: '' } };
        expect(compareByLastSeen(withDate, noTimestamp)).toBeGreaterThan(0);
    });
});

describe('compareByLastActive', () => {
    it('returns 0 when ref is undefined', () => {
        expect(compareByLastActive({}, {})).toBe(0);
    });

    it('compares by last_activity when neither is online', () => {
        const recent = {
            state: 'offline',
            ref: { last_activity: '2024-01-02T00:00:00Z' }
        };
        const older = {
            state: 'offline',
            ref: { last_activity: '2024-01-01T00:00:00Z' }
        };
        expect(compareByLastActive(recent, older)).toBeLessThan(0);
    });

    it('compares by $online_for when both are online', () => {
        const longerOnline = {
            state: 'online',
            ref: { $online_for: '2024-01-01T00:00:00Z' }
        };
        const shorterOnline = {
            state: 'online',
            ref: { $online_for: '2024-01-02T00:00:00Z' }
        };
        expect(
            compareByLastActive(longerOnline, shorterOnline)
        ).toBeGreaterThan(0);
    });
});

describe('compareByLocationAt', () => {
    it('returns 0 when both are traveling', () => {
        const a = { location: 'traveling', $location_at: '' };
        const b = { location: 'traveling', $location_at: '2024-01-01' };
        expect(compareByLocationAt(a, b)).toBe(0);
    });

    it('sorts traveling after non-traveling', () => {
        const traveling = { location: 'traveling', $location_at: '2024-01-01' };
        const real = { location: 'wrld_abc:12345', $location_at: '2024-01-01' };
        expect(compareByLocationAt(traveling, real)).toBeGreaterThan(0);
        expect(compareByLocationAt(real, traveling)).toBeLessThan(0);
    });

    it('sorts by $location_at ascending when neither is traveling', () => {
        const earlier = { location: 'wrld_abc:1', $location_at: '2024-01-01' };
        const later = { location: 'wrld_abc:2', $location_at: '2024-01-02' };
        expect(compareByLocationAt(earlier, later)).toBeLessThan(0);
        expect(compareByLocationAt(later, earlier)).toBeGreaterThan(0);
    });

    it('returns 0 for equal $location_at', () => {
        const a = { location: 'wrld_abc:1', $location_at: '2024-01-01' };
        const b = { location: 'wrld_abc:2', $location_at: '2024-01-01' };
        expect(compareByLocationAt(a, b)).toBe(0);
    });
});

describe('compareByPrivate', () => {
    it('returns 0 when either ref is undefined', () => {
        expect(compareByPrivate({}, {})).toBe(0);
        expect(compareByPrivate({ ref: { location: 'private' } }, {})).toBe(0);
    });

    it('sorts private location after non-private', () => {
        const priv = { ref: { location: 'private' } };
        const pub = { ref: { location: 'wrld_abc:12345' } };
        expect(compareByPrivate(priv, pub)).toBeGreaterThan(0);
        expect(compareByPrivate(pub, priv)).toBeLessThan(0);
    });

    it('returns 0 when both are private', () => {
        const a = { ref: { location: 'private' } };
        const b = { ref: { location: 'private' } };
        expect(compareByPrivate(a, b)).toBe(0);
    });

    it('returns 0 when neither is private', () => {
        const a = { ref: { location: 'wrld_abc:1' } };
        const b = { ref: { location: 'wrld_abc:2' } };
        expect(compareByPrivate(a, b)).toBe(0);
    });
});
