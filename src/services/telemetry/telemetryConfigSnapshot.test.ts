import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

function mockDeps(options: {
    anonymous: boolean;
    bools?: Record<string, boolean>;
    strings?: Record<string, string>;
    reportedVersion?: string;
}) {
    const postTelemetry = vi.fn(() => Promise.resolve());
    const setString = vi.fn(() => Promise.resolve());
    const getBool = vi.fn((key: string, def: boolean) =>
        Promise.resolve(options.bools?.[key] ?? def)
    );
    const getString = vi.fn((key: string, def: string) => {
        if (key === 'telemetryConfigReportedVersion') {
            return Promise.resolve(options.reportedVersion ?? '');
        }
        return Promise.resolve(options.strings?.[key] ?? def);
    });

    vi.doMock('@/repositories/configRepository', () => ({
        default: { getBool, getString, setString }
    }));
    vi.doMock('./telemetryConfig', () => ({
        TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY:
            'telemetryConfigReportedVersion',
        isAnonymousUsageTelemetryEnabled: () => options.anonymous
    }));
    vi.doMock('./telemetryClient', () => ({ postTelemetry }));
    vi.doMock('./telemetryPayload', () => ({
        buildTelemetryContext: () => ({ installId: 'i', sessionId: 's' })
    }));

    return { postTelemetry, setString };
}

describe('buildConfigSnapshot', () => {
    it('reads booleans and normalizes enum strings to lowercase slugs', async () => {
        mockDeps({
            anonymous: true,
            bools: {
                backgroundModeEnabled: true,
                ovrtWristNotifications: true,
                discordActive: true
            },
            strings: {
                autoAcceptInviteRequests: 'Friends',
                avatarAutoCleanup: 'Off',
                ThemeMode: 'Dark'
            }
        });
        const { buildConfigSnapshot } =
            await import('./telemetryConfigSnapshot');

        expect(await buildConfigSnapshot()).toEqual({
            backgroundModeEnabled: true,
            wristOverlayEnabled: false,
            xsNotifications: true,
            ovrtHudNotifications: true,
            ovrtWristNotifications: true,
            discordActive: true,
            autoStateChangeEnabled: false,
            autoAcceptInviteRequests: 'friends',
            avatarAutoCleanup: 'off',
            themeMode: 'dark'
        });
    });
});

describe('sendConfigSnapshot', () => {
    const session = { installId: 'i', sessionId: 's' };

    it('skips when anonymous usage telemetry is off', async () => {
        const { postTelemetry } = mockDeps({ anonymous: false });
        const { sendConfigSnapshot } =
            await import('./telemetryConfigSnapshot');
        await sendConfigSnapshot(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });

    it('skips when the current version was already reported', async () => {
        vi.stubGlobal('VERSION', '2.5.0');
        const { postTelemetry } = mockDeps({
            anonymous: true,
            reportedVersion: '2.5.0'
        });
        const { sendConfigSnapshot } =
            await import('./telemetryConfigSnapshot');
        await sendConfigSnapshot(session);
        expect(postTelemetry).not.toHaveBeenCalled();
    });

    it('posts the snapshot and marks the version when it changed', async () => {
        vi.stubGlobal('VERSION', '2.5.0');
        const { postTelemetry, setString } = mockDeps({
            anonymous: true,
            reportedVersion: '2.4.0'
        });
        const { sendConfigSnapshot } =
            await import('./telemetryConfigSnapshot');
        await sendConfigSnapshot(session);

        expect(postTelemetry).toHaveBeenCalledWith(
            '/api/v1/telemetry/config',
            expect.objectContaining({
                installId: 'i',
                config: expect.objectContaining({
                    backgroundModeEnabled: expect.any(Boolean)
                })
            })
        );
        expect(setString).toHaveBeenCalledWith(
            'telemetryConfigReportedVersion',
            '2.5.0'
        );
    });
});
