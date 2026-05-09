import { backend } from '@/platform/index.js';
import { useRuntimeStore } from '@/state/runtimeStore.js';

const HOST_CAPABILITY_KEYS = Object.freeze([
    'localDatabase',
    'websocketRuntime',
    'gameLogWatcher',
    'gameProcessMonitor',
    'vrchatPathDiscovery',
    'steamLibraryDiscovery',
    'steamRuntimeIntegration',
    'registryPrefs',
    'gameLaunch',
    'ipc',
    'vrchatLaunchPipe',
    'screenshotCache'
]);

const HOST_PLATFORMS = new Set(['windows', 'linux', 'macos', 'unknown']);
const HOST_ARCHITECTURES = new Set(['x86_64', 'aarch64', 'unknown']);

function normalizeCapabilityStatus(value, fallbackReason) {
    let reason = '';
    if (value?.reason) {
        reason = String(value.reason);
    } else if (fallbackReason) {
        reason = String(fallbackReason);
    }
    const status = {
        supported: Boolean(value?.supported),
        enabled: Boolean(value?.enabled),
        available: Boolean(value?.available)
    };
    if (reason) {
        status.reason = reason;
    }
    return status;
}

function createUnavailableCapabilities(reason) {
    return HOST_CAPABILITY_KEYS.reduce(
        (acc, key) => {
            acc[key] = normalizeCapabilityStatus(null, reason);
            return acc;
        },
        { platform: 'unknown', arch: 'unknown' }
    );
}

function normalizeHostCapabilities(payload) {
    const platform = HOST_PLATFORMS.has(payload?.platform)
        ? payload.platform
        : 'unknown';
    const arch = HOST_ARCHITECTURES.has(payload?.arch)
        ? payload.arch
        : 'unknown';
    return HOST_CAPABILITY_KEYS.reduce(
        (acc, key) => {
            acc[key] = normalizeCapabilityStatus(
                payload?.[key],
                `${key} is unavailable on ${platform}`
            );
            return acc;
        },
        { platform, arch }
    );
}

export async function initializeHostCapabilities() {
    const runtimeStore = useRuntimeStore.getState();
    runtimeStore.setStartupTask(
        'capabilities',
        'running',
        'Loading host capabilities.'
    );

    try {
        const capabilities = normalizeHostCapabilities(
            await backend.app.GetHostCapabilities()
        );
        useRuntimeStore.getState().setHostCapabilities(capabilities);
        useRuntimeStore
            .getState()
            .setStartupTask(
                'capabilities',
                'completed',
                `Host capabilities loaded for ${capabilities.platform}.`
            );
        return capabilities;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const capabilities = createUnavailableCapabilities(message);
        useRuntimeStore.getState().setHostCapabilities(capabilities);
        useRuntimeStore
            .getState()
            .setStartupTask('capabilities', 'error', message);
        throw error;
    }
}

export async function refreshHostCapabilities() {
    const capabilities = normalizeHostCapabilities(
        await backend.app.GetHostCapabilities()
    );
    useRuntimeStore.getState().setHostCapabilities(capabilities);
    return capabilities;
}

export function getHostCapabilityStatus(key) {
    return useRuntimeStore.getState().hostCapabilities?.[key] || null;
}

export function isHostCapabilityAvailable(key) {
    return Boolean(getHostCapabilityStatus(key)?.available);
}

export function isHostCapabilitySupported(key) {
    const status = getHostCapabilityStatus(key);
    return Boolean(status?.supported && status?.enabled);
}

export function getHostCapabilityUnavailableReason(key) {
    const status = getHostCapabilityStatus(key);
    return status?.reason || `${key} is unavailable in the current host.`;
}

export function requireHostCapability(key) {
    if (isHostCapabilityAvailable(key)) {
        return;
    }
    throw new Error(getHostCapabilityUnavailableReason(key));
}

export function requireHostCapabilitySupported(key) {
    if (isHostCapabilitySupported(key)) {
        return;
    }
    throw new Error(getHostCapabilityUnavailableReason(key));
}
