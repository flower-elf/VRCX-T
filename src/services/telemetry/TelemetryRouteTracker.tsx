import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { recordTelemetryFeature } from './telemetryService';
import {
    TELEMETRY_FEATURE_KEYS,
    type TelemetryFeatureKey
} from './telemetryTypes';

function featureForPath(pathname: string): TelemetryFeatureKey | null {
    if (pathname.startsWith('/dashboard/')) {
        return TELEMETRY_FEATURE_KEYS.dashboard;
    }
    return null;
}

export function TelemetryRouteTracker() {
    const location = useLocation();
    const lastFeatureRef = useRef<TelemetryFeatureKey | null>(null);

    useEffect(() => {
        const featureKey = featureForPath(location.pathname);
        if (!featureKey) {
            lastFeatureRef.current = null;
            return;
        }
        if (featureKey === lastFeatureRef.current) {
            return;
        }
        lastFeatureRef.current = featureKey;
        recordTelemetryFeature(featureKey);
    }, [location.pathname]);

    return null;
}
