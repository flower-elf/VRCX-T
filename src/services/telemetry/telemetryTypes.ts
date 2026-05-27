import type { BackendRuntimeMode } from '@/platform/tauri/appCommandTypes';

export type TelemetryRuntimeMode = BackendRuntimeMode;

export type TelemetryFeatureKey =
    | 'quick_search'
    | 'dashboard'
    | 'background_mode';

export type TelemetryContextPayload = {
    installId: string;
    sessionId: string;
    appVersion: string;
    platform: string;
    arch: string;
    locale: string;
    timezone: string;
    mode: TelemetryRuntimeMode;
    vrchatRunning: boolean;
    localWeekday: number;
    localHour: number;
};

export type TelemetryEventPayload =
    | (TelemetryContextPayload & {
          eventType: 'feature';
          featureKey: TelemetryFeatureKey;
      })
    | (TelemetryContextPayload & {
          eventType: 'error';
          errorCode: string;
      });

export type TelemetrySessionState = {
    installId: string;
    sessionId: string;
};

export const TELEMETRY_FEATURE_KEYS = Object.freeze({
    quickSearch: 'quick_search',
    dashboard: 'dashboard',
    backgroundMode: 'background_mode'
} satisfies Record<string, TelemetryFeatureKey>);
