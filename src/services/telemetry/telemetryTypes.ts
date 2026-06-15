import type { BackendRuntimeMode } from '@/platform/tauri/appCommandTypes';

export type TelemetryRuntimeMode = BackendRuntimeMode;

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
    sessionEnded?: boolean;
};

export type TelemetryVrchatLifecycleState = 'started' | 'stopped';

export type TelemetryVrchatLifecyclePayload = TelemetryContextPayload & {
    state: TelemetryVrchatLifecycleState;
};

export type TelemetrySessionState = {
    installId: string;
    sessionId: string;
    isNewInstall?: boolean;
};

export type TelemetryConfigSnapshot = {
    backgroundModeEnabled: boolean;
    wristOverlayEnabled: boolean;
    xsNotifications: boolean;
    ovrtHudNotifications: boolean;
    ovrtWristNotifications: boolean;
    discordActive: boolean;
    autoStateChangeEnabled: boolean;
    autoAcceptInviteRequests: string;
    avatarAutoCleanup: string;
    themeMode: string;
};

export type TelemetryConfigSnapshotPayload = TelemetryContextPayload & {
    config: TelemetryConfigSnapshot;
};

export type TelemetryViewModeDimension =
    | 'gameLogViewMode'
    | 'myAvatarsViewMode'
    | 'feedViewMode'
    | 'feedTimeDisplayMode';

export type TelemetryViewModeUsageEntry = {
    dimension: TelemetryViewModeDimension;
    used: string[];
    switches: number;
};

export type TelemetryViewModeUsagePayload = TelemetryContextPayload & {
    modes: TelemetryViewModeUsageEntry[];
};
