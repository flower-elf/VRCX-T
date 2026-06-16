import { create } from 'zustand';

import { userFactKey, type UserFact } from '@/domain/users/userFacts';

interface UserFactsStoreState {
    version: number;
    usersByKey: Record<string, UserFact>;
    userIdsByEndpoint: Record<string, string[]>;
    replaceUserFacts: (users: Array<Record<string, unknown>>) => void;
    resetUserFacts: () => void;
}

const initialState: any = {
    version: 0,
    usersByKey: {},
    userIdsByEndpoint: {}
};

function endpointFromKey(key: string): string {
    return key.split('::')[0] || 'default';
}

export const useUserFactsStore = create<UserFactsStoreState>((set: any) => ({
    ...initialState,
    replaceUserFacts(users: any) {
        set((state: any) => {
            const list = Array.isArray(users) ? users : [];
            if (list.length === 0) {
                return state;
            }
            let usersByKey = state.usersByKey;
            let userIdsByEndpoint = state.userIdsByEndpoint;
            let changed = false;
            for (const user of list) {
                if (!user || typeof user !== 'object') {
                    continue;
                }
                const key = userFactKey(user.endpoint, user.id ?? user.userId);
                if (!key) {
                    continue;
                }
                if (!changed) {
                    usersByKey = { ...usersByKey };
                    userIdsByEndpoint = { ...userIdsByEndpoint };
                    changed = true;
                }
                usersByKey[key] = user;
                const endpoint = endpointFromKey(key);
                const userId = user.id ?? user.userId;
                const currentIds = userIdsByEndpoint[endpoint] || [];
                if (userId && !currentIds.includes(userId)) {
                    userIdsByEndpoint[endpoint] = [...currentIds, userId];
                }
            }
            if (!changed) {
                return state;
            }
            return {
                version: state.version + 1,
                usersByKey,
                userIdsByEndpoint
            };
        });
    },
    resetUserFacts() {
        set(initialState);
    }
}));

export type { UserFactsStoreState };
