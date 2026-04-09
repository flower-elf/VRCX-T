import { computed, watch } from 'vue';
import {
    commaNumber,
    compareUnityVersion,
    formatDateFilter,
    parseLocation,
    timeToText
} from '../../../shared/utils';
import { database } from '../../../services/database';
import { useLocationStore } from '../../../stores';

/**
 * Composable for WorldDialogInfoTab computed properties and actions.
 * @param {import('vue').Ref} worldDialog - reactive ref to the world dialog state
 * @param {object} deps - external dependencies
 * @param {Function} deps.t - i18n translation function
 * @param {Function} deps.toast - toast notification function
 * @param deps.sdkUnityVersion
 * @returns {object} info composable API
 */
export function useWorldDialogInfo(worldDialog, { t, toast, sdkUnityVersion }) {
    const locationStore = useLocationStore();

    const memo = computed({
        get() {
            return worldDialog.value.memo;
        },
        set(value) {
            worldDialog.value.memo = value;
        }
    });

    const isTimeInLabVisible = computed(() => {
        return (
            worldDialog.value.ref.publicationDate &&
            worldDialog.value.ref.publicationDate !== 'none' &&
            worldDialog.value.ref.labsPublicationDate &&
            worldDialog.value.ref.labsPublicationDate !== 'none'
        );
    });

    const timeInLab = computed(() => {
        return timeToText(
            new Date(worldDialog.value.ref.publicationDate).getTime() -
                new Date(worldDialog.value.ref.labsPublicationDate).getTime()
        );
    });

    const favoriteRate = computed(() => {
        return (
            Math.round(
                (((worldDialog.value.ref?.favorites -
                    worldDialog.value.ref?.visits) /
                    worldDialog.value.ref?.visits) *
                    100 +
                    100) *
                    100
            ) / 100
        );
    });

    const worldTags = computed(() => {
        return worldDialog.value.ref?.tags
            .filter((tag) => tag.startsWith('author_tag'))
            .map((tag) => tag.replace('author_tag_', ''))
            .join(', ');
    });

    const timeSpent = computed(() => {
        return timeToText(worldDialog.value.timeSpent);
    });

    const worldDialogPlatform = computed(() => {
        const { ref } = worldDialog.value;
        const platforms = [];
        if (ref.unityPackages) {
            for (const unityPackage of ref.unityPackages) {
                if (
                    !compareUnityVersion(
                        unityPackage.unitySortNumber,
                        sdkUnityVersion
                    )
                ) {
                    continue;
                }
                let platform = 'PC';
                if (unityPackage.platform === 'standalonewindows') {
                    platform = 'PC';
                } else if (unityPackage.platform === 'android') {
                    platform = 'Android';
                } else if (unityPackage.platform) {
                    platform = unityPackage.platform;
                }
                platforms.unshift(`${platform}/${unityPackage.unityVersion}`);
            }
        }
        return platforms.join(', ');
    });

    const worldDialogPlatformCreatedAt = computed(() => {
        const fileAnalysis = worldDialog.value.fileAnalysis || {};
        const fileAnalysisPlatforms = Object.entries(fileAnalysis);
        if (fileAnalysisPlatforms.length > 0) {
            const newest = {};
            for (const [platform, analysis] of fileAnalysisPlatforms) {
                if (!analysis?.created_at) {
                    continue;
                }
                newest[platform] = analysis.created_at;
            }
            if (Object.keys(newest).length > 0) {
                return newest;
            }
        }

        const { ref } = worldDialog.value;
        if (!ref.unityPackages) {
            return null;
        }
        let newest = {};
        for (const unityPackage of ref.unityPackages) {
            if (
                unityPackage.variant &&
                unityPackage.variant !== 'standard' &&
                unityPackage.variant !== 'security'
            ) {
                continue;
            }
            const platform = unityPackage.platform;
            const createdAt = unityPackage.created_at;
            if (
                !newest[platform] ||
                new Date(createdAt) > new Date(newest[platform])
            ) {
                newest[platform] = createdAt;
            }
        }
        return newest;
    });

    const worldDialogLastUpdatedAt = computed(() => {
        const platformDates = worldDialogPlatformCreatedAt.value;
        if (platformDates && Object.keys(platformDates).length > 0) {
            return Object.values(platformDates).reduce((latest, current) => {
                if (!latest) {
                    return current;
                }
                return new Date(current) > new Date(latest) ? current : latest;
            }, '');
        }
        return worldDialog.value.ref.updated_at;
    });

    async function ensureWorldStatsLoaded() {
        const dialog = worldDialog.value;
        if (
            !dialog.visible ||
            dialog.activeTab !== 'Info' ||
            !dialog.id ||
            dialog.worldStatsLoaded ||
            dialog.worldStatsLoading
        ) {
            return;
        }

        dialog.worldStatsLoading = true;
        const worldId = dialog.id;
        const currentWorldMatch =
            parseLocation(locationStore.lastLocation.location).worldId === worldId;

        try {
            const [lastVisit, visitCount, timeSpent] = await Promise.all([
                database.getLastVisit(worldId, currentWorldMatch),
                database.getVisitCount(worldId),
                database.getTimeSpentInWorld(worldId)
            ]);

            if (worldDialog.value.id !== worldId) {
                return;
            }

            if (lastVisit.worldId === worldId) {
                dialog.lastVisit = lastVisit.created_at;
            }
            if (visitCount.worldId === worldId) {
                dialog.visitCount = visitCount.visitCount;
            }
            if (timeSpent.worldId === worldId) {
                dialog.timeSpent = timeSpent.timeSpent;
            }
            dialog.worldStatsLoaded = true;
        } finally {
            if (worldDialog.value.id === worldId) {
                dialog.worldStatsLoading = false;
            }
        }
    }

    watch(
        () => [worldDialog.value.visible, worldDialog.value.activeTab, worldDialog.value.id],
        () => {
            ensureWorldStatsLoaded();
        },
        { immediate: true }
    );

    /**
     *
     */
    function onWorldMemoChange() {
        const worldId = worldDialog.value.id;
        const memo = worldDialog.value.memo;
        if (memo) {
            database.setWorldMemo({
                worldId,
                editedAt: new Date().toJSON(),
                memo
            });
        } else {
            database.deleteWorldMemo(worldId);
        }
    }

    /**
     *
     */
    function copyWorldId() {
        navigator.clipboard
            .writeText(worldDialog.value.id)
            .then(() => {
                toast.success(t('message.world.id_copied'));
            })
            .catch((err) => {
                console.error('copy failed:', err);
                toast.error(t('message.copy_failed'));
            });
    }

    /**
     *
     */
    function copyWorldUrl() {
        navigator.clipboard
            .writeText(`https://vrchat.com/home/world/${worldDialog.value.id}`)
            .then(() => {
                toast.success(t('message.world.url_copied'));
            })
            .catch((err) => {
                console.error('copy failed:', err);
                toast.error(t('message.copy_failed'));
            });
    }

    /**
     *
     */
    function copyWorldName() {
        navigator.clipboard
            .writeText(worldDialog.value.ref.name)
            .then(() => {
                toast.success(t('message.world.name_copied'));
            })
            .catch((err) => {
                console.error('copy failed:', err);
                toast.error(t('message.copy_failed'));
            });
    }

    return {
        memo,
        isTimeInLabVisible,
        timeInLab,
        favoriteRate,
        worldTags,
        timeSpent,
        worldDialogPlatform,
        worldDialogPlatformCreatedAt,
        worldDialogLastUpdatedAt,
        onWorldMemoChange,
        copyWorldId,
        copyWorldUrl,
        copyWorldName,
        commaNumber,
        formatDateFilter
    };
}
