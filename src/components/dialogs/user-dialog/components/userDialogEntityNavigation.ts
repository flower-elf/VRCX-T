import {
    openAvatarDialog,
    openGroupDialog,
    openUserDialog,
    openWorldDialog
} from '@/services/dialogService';
import {
    hasAvatarIdPrefix,
    hasGroupIdPrefix,
    hasUserIdPrefix,
    hasWorldIdPrefix
} from '@/shared/constants/vrchatIds';

export function openRow(row: any, kind: any) {
    const id =
        typeof row === 'string'
            ? row
            : row?.id ||
              row?.userId ||
              row?.worldId ||
              row?.avatarId ||
              row?.groupId;
    if (!id) {
        return;
    }
    if (kind === 'user' || hasUserIdPrefix(id)) {
        openUserDialog({
            userId: id,
            title: row?.displayName || row?.username || undefined,
            seedData: typeof row === 'object' ? row : null
        });
        return;
    }
    if (
        kind === 'world' ||
        hasWorldIdPrefix(id) ||
        String(id).startsWith('wld_')
    ) {
        openWorldDialog({
            worldId: id,
            title: row?.name || undefined,
            seedData: typeof row === 'object' ? row : null
        });
        return;
    }
    if (kind === 'avatar' || hasAvatarIdPrefix(id)) {
        openAvatarDialog({
            avatarId: id,
            title: row?.name || undefined,
            seedData: typeof row === 'object' ? row : null
        });
        return;
    }
    if (kind === 'group' || hasGroupIdPrefix(id)) {
        openGroupDialog({
            groupId: id,
            title: row?.name || undefined,
            seedData: typeof row === 'object' ? row : null
        });
    }
}
