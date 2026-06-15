import configRepository from '@/repositories/configRepository';

import { postTelemetry } from './telemetryClient';
import {
    TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
    isAnonymousUsageTelemetryEnabled
} from './telemetryConfig';
import { buildTelemetryContext } from './telemetryPayload';
import type {
    TelemetryConfigSnapshot,
    TelemetrySessionState
} from './telemetryTypes';

const ENUM_VALUE_MAX_LENGTH = 32;

function currentTelemetryVersion(): string {
    return typeof VERSION === 'string' && VERSION ? VERSION : 'unknown';
}

function normalizeEnum(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, ENUM_VALUE_MAX_LENGTH);
    return normalized || 'unknown';
}

export async function buildConfigSnapshot(): Promise<TelemetryConfigSnapshot> {
    const [
        backgroundModeEnabled,
        wristOverlayEnabled,
        xsNotifications,
        ovrtHudNotifications,
        ovrtWristNotifications,
        discordActive,
        autoStateChangeEnabled,
        autoAcceptInviteRequests,
        avatarAutoCleanup,
        themeMode
    ] = await Promise.all([
        configRepository.getBool('backgroundModeEnabled', false),
        configRepository.getBool('wristOverlayEnabled', false),
        configRepository.getBool('xsNotifications', true),
        configRepository.getBool('ovrtHudNotifications', true),
        configRepository.getBool('ovrtWristNotifications', false),
        configRepository.getBool('discordActive', false),
        configRepository.getBool('autoStateChangeEnabled', false),
        configRepository.getString('autoAcceptInviteRequests', 'Off'),
        configRepository.getString('avatarAutoCleanup', 'Off'),
        configRepository.getString('ThemeMode', '')
    ]);

    return {
        backgroundModeEnabled,
        wristOverlayEnabled,
        xsNotifications,
        ovrtHudNotifications,
        ovrtWristNotifications,
        discordActive,
        autoStateChangeEnabled,
        autoAcceptInviteRequests: normalizeEnum(autoAcceptInviteRequests),
        avatarAutoCleanup: normalizeEnum(avatarAutoCleanup),
        themeMode: normalizeEnum(themeMode)
    };
}

export async function sendConfigSnapshot(
    session: TelemetrySessionState
): Promise<void> {
    if (!isAnonymousUsageTelemetryEnabled()) {
        return;
    }

    const version = currentTelemetryVersion();
    const reportedVersion = await configRepository.getString(
        TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
        ''
    );
    if (reportedVersion === version) {
        return;
    }

    const config = await buildConfigSnapshot();
    await postTelemetry('/api/v1/telemetry/config', {
        ...buildTelemetryContext(session),
        config
    });
    await configRepository.setString(
        TELEMETRY_CONFIG_REPORTED_VERSION_CONFIG_KEY,
        version
    );
}
