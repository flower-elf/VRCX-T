export const TELEMETRY_INSTALL_ID_CONFIG_KEY = 'telemetryInstallId';
export const TELEMETRY_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;
export const TELEMETRY_REQUEST_TIMEOUT_MS = 15_000;

export function getTelemetryEndpoint(): string {
    return String(VRCX_0_TELEMETRY_ENDPOINT || '').trim().replace(/\/+$/, '');
}

export function isTelemetryEnabled(): boolean {
    return getTelemetryEndpoint().length > 0;
}
