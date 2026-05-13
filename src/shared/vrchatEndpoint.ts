export const DEFAULT_VRCHAT_API_ENDPOINT = 'https://api.vrchat.cloud/api/1';

type VrchatEndpointOptions = Record<string, unknown> & {
    allowDebugEndpoint?: unknown;
};

type DebugGlobal = typeof globalThis & {
    $debug?: {
        endpointDomain?: unknown;
    };
};

function normalizeEndpointValue(endpoint: unknown): string {
    return typeof endpoint === 'string'
        ? endpoint.trim()
        : String(endpoint ?? '').trim();
}

export function normalizeVrchatEndpoint(
    endpoint: unknown = '',
    options: VrchatEndpointOptions = {}
): string {
    const explicitEndpoint = normalizeEndpointValue(endpoint);
    if (explicitEndpoint) {
        return explicitEndpoint;
    }

    if (options.allowDebugEndpoint) {
        const debugEndpoint = normalizeEndpointValue(
            (globalThis as DebugGlobal)?.$debug?.endpointDomain
        );
        if (debugEndpoint) {
            return debugEndpoint;
        }
    }

    return DEFAULT_VRCHAT_API_ENDPOINT;
}

export function normalizeVrchatEndpointKey(endpoint: unknown = ''): string {
    return normalizeEndpointValue(endpoint).replace(/\/+$/, '');
}

export function normalizeVrchatEndpointDomain(
    endpoint: unknown = '',
    options: VrchatEndpointOptions = {}
): string {
    return normalizeVrchatEndpoint(endpoint, options).replace(/\/+$/, '');
}

export function getVrchatEndpointBase(
    endpoint: unknown = '',
    options: VrchatEndpointOptions = {}
): string {
    return `${normalizeVrchatEndpointDomain(endpoint, options)}/`;
}
