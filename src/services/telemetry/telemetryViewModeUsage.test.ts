import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
});

function mockDeps(options: {
    anonymous: boolean;
    persisted?: Record<string, string>;
}) {
    const postTelemetry = vi.fn((_path: string, _payload: unknown) =>
        Promise.resolve()
    );
    const getString = vi.fn((key: string, def: string) =>
        Promise.resolve(options.persisted?.[key] ?? def)
    );

    vi.doMock('@/repositories/configRepository', () => ({
        default: { getString }
    }));
    vi.doMock('./telemetryConfig', () => ({
        isAnonymousUsageTelemetryEnabled: () => options.anonymous
    }));
    vi.doMock('./telemetryClient', () => ({ postTelemetry }));
    vi.doMock('./telemetryPayload', () => ({
        buildTelemetryContext: () => ({ installId: 'i' })
    }));

    return { postTelemetry };
}

const session = { installId: 'i', sessionId: 's' };

function findDimension(payload: any, dimension: string) {
    return payload.modes.find((mode: any) => mode.dimension === dimension);
}

describe('view mode usage telemetry', () => {
    it('seeds the persisted starting value without counting it as a switch', async () => {
        const { postTelemetry } = mockDeps({
            anonymous: true,
            persisted: {
                gameLogViewMode: 'table',
                MyAvatarsViewMode: 'grid',
                feedViewMode: 'columns',
                feedTimeDisplayMode: 'exact'
            }
        });
        const mod = await import('./telemetryViewModeUsage');
        await mod.seedViewModeUsage();
        await mod.sendViewModeUsage(session);

        const [path, payload] = postTelemetry.mock.calls[0] as [string, any];
        expect(path).toBe('/api/v1/telemetry/view-mode');
        expect(findDimension(payload, 'gameLogViewMode')).toEqual({
            dimension: 'gameLogViewMode',
            used: ['table'],
            switches: 0
        });
    });

    it('accumulates the used set and switch count, ignoring invalid values', async () => {
        const { postTelemetry } = mockDeps({ anonymous: true });
        const mod = await import('./telemetryViewModeUsage');
        await mod.seedViewModeUsage(); // seeds gameLogViewMode -> 'sessions'
        mod.recordViewModeUsage('gameLogViewMode', 'table');
        mod.recordViewModeUsage('gameLogViewMode', 'sessions');
        mod.recordViewModeUsage('gameLogViewMode', 'bogus');
        await mod.sendViewModeUsage(session);

        const payload = postTelemetry.mock.calls[0]?.[1] as any;
        expect(findDimension(payload, 'gameLogViewMode')).toEqual({
            dimension: 'gameLogViewMode',
            used: ['sessions', 'table'],
            switches: 2
        });
    });

    it('does not send when anonymous usage telemetry is off', async () => {
        const { postTelemetry } = mockDeps({ anonymous: false });
        const mod = await import('./telemetryViewModeUsage');
        await mod.seedViewModeUsage();
        mod.recordViewModeUsage('feedViewMode', 'columns');
        await mod.sendViewModeUsage(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });

    it('clears accumulated usage on reset', async () => {
        const { postTelemetry } = mockDeps({ anonymous: true });
        const mod = await import('./telemetryViewModeUsage');
        await mod.seedViewModeUsage();
        mod.resetViewModeUsage();
        await mod.sendViewModeUsage(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });
});
