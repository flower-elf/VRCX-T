import { authRepository } from '@/repositories/index.js';
import { useRuntimeStore } from '@/state/runtimeStore.js';

type SavedAuthSnapshot = Record<string, unknown> & {
    lastUserLoggedIn: unknown;
    savedCredentialCount: unknown;
    autoLoginStatus: string;
    autoLoginReason: string;
    autoLoginDelayEnabled: unknown;
    autoLoginDelaySeconds: unknown;
};

type AuthStartupTask = {
    status: string;
    detail: string;
};

function describeAuthStartupTask(snapshot: SavedAuthSnapshot): AuthStartupTask {
    switch (snapshot.autoLoginStatus) {
        case 'available':
            return {
                status: 'pending',
                detail: snapshot.autoLoginReason
            };
        case 'missing-last-user':
        case 'missing-credentials':
            return {
                status: 'completed',
                detail: snapshot.autoLoginReason
            };
        default:
            return {
                status: 'completed',
                detail:
                    snapshot.autoLoginReason ||
                    'No saved credentials were detected.'
            };
    }
}

export function applySavedAuthSnapshot(
    snapshot: SavedAuthSnapshot
): SavedAuthSnapshot {
    const runtimeStore = useRuntimeStore.getState();
    runtimeStore.setAuthBootstrap({
        lastUserLoggedIn: snapshot.lastUserLoggedIn,
        savedCredentialCount: snapshot.savedCredentialCount,
        autoLoginStatus: snapshot.autoLoginStatus,
        autoLoginReason: snapshot.autoLoginReason,
        autoLoginDelayEnabled: snapshot.autoLoginDelayEnabled,
        autoLoginDelaySeconds: snapshot.autoLoginDelaySeconds
    });

    const task = describeAuthStartupTask(snapshot);
    runtimeStore.setStartupTask('auth', task.status, task.detail);
    return snapshot;
}

export async function refreshSavedAuthSnapshot() {
    const snapshot = await authRepository.getSavedAuthSnapshot();
    return applySavedAuthSnapshot(snapshot);
}

export async function deleteSavedAuthSnapshot(userId: string) {
    const snapshot = await authRepository.deleteSavedCredential(userId);
    return applySavedAuthSnapshot(snapshot);
}
