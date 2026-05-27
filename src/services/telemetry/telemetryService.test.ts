import { afterEach, describe, expect, it, vi } from 'vitest';

describe('startTelemetryLifecycle', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.resetModules();
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('does not start a second heartbeat while the previous heartbeat is pending', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('window', {
            setInterval: globalThis.setInterval,
            clearInterval: globalThis.clearInterval
        });
        const heartbeatResolvers: Array<() => void> = [];
        const postTelemetry = vi.fn((path: string) => {
            if (path.endsWith('/session/heartbeat')) {
                return new Promise<void>((resolve) => {
                    heartbeatResolvers.push(resolve);
                });
            }
            return Promise.resolve();
        });

        vi.doMock('./telemetryConfig', () => ({
            TELEMETRY_HEARTBEAT_INTERVAL_MS: 1_000,
            isTelemetryEnabled: () => true
        }));
        vi.doMock('./telemetryClient', () => ({ postTelemetry }));
        vi.doMock('./telemetryIdentity', () => ({
            createTelemetrySessionId: () => 'session-test',
            getOrCreateTelemetryInstallId: () => Promise.resolve('install-test')
        }));
        vi.doMock('./telemetryPayload', () => ({
            buildTelemetryContext: () => ({}),
            getCurrentTelemetryMode: () => 'foreground',
            waitForInitialTelemetryContext: () => Promise.resolve()
        }));
        vi.doMock('@/state/runtimeStore', () => ({
            useRuntimeStore: {
                subscribe: vi.fn(() => vi.fn())
            }
        }));

        const { startTelemetryLifecycle } = await import('./telemetryService');
        const cleanup = startTelemetryLifecycle();

        await vi.waitFor(() =>
            expect(postTelemetry).toHaveBeenCalledWith(
                '/api/v1/telemetry/session/start',
                {}
            )
        );

        await vi.advanceTimersByTimeAsync(1_000);
        expect(
            postTelemetry.mock.calls.filter(([path]) =>
                String(path).endsWith('/session/heartbeat')
            )
        ).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(
            postTelemetry.mock.calls.filter(([path]) =>
                String(path).endsWith('/session/heartbeat')
            )
        ).toHaveLength(1);

        heartbeatResolvers[0]?.();
        await Promise.resolve();

        await vi.advanceTimersByTimeAsync(1_000);
        expect(
            postTelemetry.mock.calls.filter(([path]) =>
                String(path).endsWith('/session/heartbeat')
            )
        ).toHaveLength(2);

        cleanup();
    });
});
