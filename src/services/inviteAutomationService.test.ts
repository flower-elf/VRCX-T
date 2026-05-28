import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
    configRepository: {
        getString: vi.fn()
    },
    notificationPersistenceRepository: {
        hideRemoteNotification: vi.fn(),
        sendInvite: vi.fn()
    },
    tauriClient: {
        app: {
            ExpireRealtimeNotification: vi.fn()
        }
    },
    vrchatSearchRepository: {
        getWorlds: vi.fn()
    }
}));

vi.mock('@/repositories/configRepository', () => ({
    default: serviceMocks.configRepository
}));

vi.mock('@/repositories/notificationPersistenceRepository', () => ({
    default: serviceMocks.notificationPersistenceRepository
}));

vi.mock('@/repositories/vrchatSearchRepository', () => ({
    default: serviceMocks.vrchatSearchRepository
}));

vi.mock('@/platform/tauri/client', () => ({
    tauriClient: serviceMocks.tauriClient
}));

import {
    handleInviteAutomationNotification,
    resetInviteAutomationService
} from './inviteAutomationService';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useVrcNotificationStore } from '@/state/vrcNotificationStore';

const API_ENDPOINT = 'https://api.vrchat.cloud';
const SELECTED_GROUPS = JSON.stringify(['friend:group_0']);

function notification(senderUserId = 'usr_sender') {
    return {
        id: `notification-${senderUserId}`,
        type: 'requestInvite',
        senderUserId,
        version: 2
    };
}

function setConfig({
    mode = 'Selected Favorites',
    groups = SELECTED_GROUPS
}: {
    mode?: string;
    groups?: string;
} = {}) {
    serviceMocks.configRepository.getString.mockImplementation(
        async (key: string, fallback: string) => {
            if (key === 'autoAcceptInviteRequests') {
                return mode;
            }
            if (key === 'autoAcceptInviteGroups') {
                return groups;
            }
            return fallback;
        }
    );
}

function setRuntimeLocation(location: string, isGameRunning = true) {
    const runtimeStore = useRuntimeStore.getState();
    runtimeStore.setAuthBootstrap({
        currentUserId: 'usr_self',
        currentUserEndpoint: API_ENDPOINT,
        currentUserSnapshot: {
            id: 'usr_self'
        }
    });
    runtimeStore.setGameState({
        isGameRunning,
        currentLocation: location
    });
}

function setFavoriteSnapshot(senderUserId = 'usr_sender') {
    useFavoriteStore.getState().setFavoritesSnapshot({
        remoteFavoritesById: {
            fvrt_record_1: {
                id: 'fvrt_record_1',
                type: 'friend',
                favoriteId: 'fvrt_shadow_id',
                $groupKey: 'friend:group_0'
            }
        },
        favoriteFriendIds: [senderUserId],
        groupedFavoriteFriendIdsByGroupKey: {
            'friend:group_0': [senderUserId]
        },
        favoriteFriendGroups: [
            {
                key: 'friend:group_0',
                count: 0
            }
        ]
    });
}

describe('inviteAutomationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetInviteAutomationService();
        useFavoriteStore.getState().resetFavorites();
        useRuntimeStore.getState().resetRuntimeState();
        useVrcNotificationStore.getState().resetVrcNotificationState();
        setConfig();
        serviceMocks.vrchatSearchRepository.getWorlds.mockResolvedValue({
            json: {
                name: 'Test World'
            }
        });
        serviceMocks.notificationPersistenceRepository.sendInvite.mockResolvedValue(
            { json: {} }
        );
        serviceMocks.notificationPersistenceRepository.hideRemoteNotification.mockResolvedValue(
            { json: {} }
        );
        serviceMocks.tauriClient.app.ExpireRealtimeNotification.mockResolvedValue(
            undefined
        );
    });

    it('sends an invite for selected remote favorite groups from an owned private instance', async () => {
        setFavoriteSnapshot('usr_sender');
        setRuntimeLocation('wrld_private:12345~private(usr_self)');

        const result = await handleInviteAutomationNotification(
            notification('usr_sender')
        );

        expect(result).toMatchObject({
            handled: true,
            reason: 'invite-sent'
        });
        expect(
            serviceMocks.notificationPersistenceRepository.sendInvite
        ).toHaveBeenCalledWith({
            receiverUserId: 'usr_sender',
            endpoint: API_ENDPOINT,
            params: {
                instanceId: 'wrld_private:12345~private(usr_self)',
                worldId: 'wrld_private',
                worldName: 'Test World',
                rsvp: true
            }
        });
    });

    it('does not send an invite when the sender is outside selected favorite groups', async () => {
        setFavoriteSnapshot('usr_sender');
        setRuntimeLocation('wrld_public:12345');

        const result = await handleInviteAutomationNotification(
            notification('usr_outside')
        );

        expect(result).toMatchObject({
            handled: false,
            reason: 'sender-not-allowlisted'
        });
        expect(
            serviceMocks.notificationPersistenceRepository.sendInvite
        ).not.toHaveBeenCalled();
    });

    it('keeps invite automation disabled while VRChat is not running', async () => {
        setFavoriteSnapshot('usr_sender');
        setRuntimeLocation('wrld_public:12345', false);

        const result = await handleInviteAutomationNotification(
            notification('usr_sender')
        );

        expect(result).toMatchObject({
            handled: false,
            reason: 'game-not-running'
        });
        expect(
            serviceMocks.notificationPersistenceRepository.sendInvite
        ).not.toHaveBeenCalled();
    });

    it('uses checkCanInvite semantics for group-plus and public instances', async () => {
        setFavoriteSnapshot('usr_sender');

        for (const currentLocation of [
            'wrld_group:group-room~group(grp_team)~groupAccessType(plus)',
            'wrld_public:12345'
        ]) {
            resetInviteAutomationService();
            setRuntimeLocation(currentLocation);

            const result = await handleInviteAutomationNotification(
                notification('usr_sender')
            );

            expect(result).toMatchObject({
                handled: true,
                reason: 'invite-sent'
            });
        }

        expect(
            serviceMocks.notificationPersistenceRepository.sendInvite
        ).toHaveBeenCalledTimes(2);
    });

    it('does not send an invite when checkCanInvite rejects the current location', async () => {
        setFavoriteSnapshot('usr_sender');
        setRuntimeLocation('wrld_friends:12345~friends(usr_owner)');

        const result = await handleInviteAutomationNotification(
            notification('usr_sender')
        );

        expect(result).toMatchObject({
            handled: false,
            reason: 'current-location-not-invitable'
        });
        expect(
            serviceMocks.notificationPersistenceRepository.sendInvite
        ).not.toHaveBeenCalled();
    });
});
