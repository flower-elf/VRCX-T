<template>
    <AlertDialog :open="isOpen">
        <AlertDialogContent
            class="sm:max-w-[460px]"
            @interact-outside.prevent
            @escape-key-down.prevent
            @pointer-down-outside.prevent
            @close-auto-focus.prevent>
            <AlertDialogHeader>
                <AlertDialogTitle>{{ title }}</AlertDialogTitle>
                <AlertDialogDescription>
                    {{ description }}
                </AlertDialogDescription>
            </AlertDialogHeader>

            <div v-if="phase === 'confirm'" class="flex justify-end gap-2 pt-2">
                <AlertDialogCancel @click="skipMigration">
                    {{ t('message.database.migration_skip') }}
                </AlertDialogCancel>
                <AlertDialogAction @click="startMigration">
                    {{ t('message.database.migration_start') }}
                </AlertDialogAction>
            </div>

            <div v-else-if="phase === 'running'" class="flex items-center gap-3 pt-2">
                <Spinner class="h-5 w-5" />
                <span class="text-sm text-muted-foreground">
                    {{ t('message.database.upgrade_in_progress_wait') }}
                </span>
            </div>

            <div v-else-if="phase === 'restarting'" class="flex items-center gap-3 pt-2">
                <Spinner class="h-5 w-5" />
                <span class="text-sm text-muted-foreground">
                    {{ t('message.database.migration_restarting') }}
                </span>
            </div>
        </AlertDialogContent>
    </AlertDialog>
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogHeader,
        AlertDialogTitle
    } from '@/components/ui/alert-dialog';
    import { Spinner } from '@/components/ui/spinner';
    import { useI18n } from 'vue-i18n';

    import { useVrcxStore } from '../../stores';

    const { t } = useI18n();
    const vrcxStore = useVrcxStore();
    const { databaseUpgradeState } = storeToRefs(vrcxStore);

    const isOpen = computed(() => databaseUpgradeState.value.visible);
    const phase = computed(() => databaseUpgradeState.value.phase || 'confirm');

    const title = computed(() => {
        if (phase.value === 'restarting') {
            return t('message.database.migration_restarting_title');
        }
        if (phase.value === 'running') {
            return t('message.database.upgrade_in_progress_title');
        }
        return t('message.database.migration_found_title');
    });

    const description = computed(() => {
        if (phase.value === 'restarting') {
            return t('message.database.migration_restarting');
        }
        if (phase.value === 'running') {
            if (databaseUpgradeState.value.fromVersion > 0) {
                return t('message.database.upgrade_in_progress_description', {
                    from: databaseUpgradeState.value.fromVersion,
                    to: databaseUpgradeState.value.toVersion
                });
            }
            return t('message.database.upgrade_in_progress_initializing');
        }
        return t('message.database.migration_found_description');
    });

    function startMigration() {
        vrcxStore.confirmLegacyMigration();
    }

    function skipMigration() {
        vrcxStore.skipLegacyMigration();
    }
</script>
