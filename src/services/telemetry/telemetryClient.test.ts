import { afterEach, describe, expect, it, vi } from 'vitest';

describe('postTelemetry', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('aborts a hung telemetry request after the timeout', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('VRCX_0_TELEMETRY_ENDPOINT', 'https://telemetry.example');

        let signal: AbortSignal | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init: RequestInit) => {
                signal = init.signal as AbortSignal | undefined;
                return new Promise<Response>(() => {});
            })
        );

        const { postTelemetry } = await import('./telemetryClient');
        postTelemetry('/api/v1/telemetry/session/heartbeat', {});

        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal?.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(15_000);

        expect(signal?.aborted).toBe(true);
    });
});
