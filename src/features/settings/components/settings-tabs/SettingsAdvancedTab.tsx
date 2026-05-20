import { useTranslation } from 'react-i18next';
import { FolderOpenIcon, RefreshCwIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shadcn/card';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/ui/shadcn/select';
import { Switch } from '@/ui/shadcn/switch';

import { Field } from '../SettingsField';
import { SettingsTabContent } from '../SettingsViewParts';
import { SettingsAdvancedDataCards } from './SettingsAdvancedDataCards';

function DataDirectoryPath({ value }: any) {
    return (
        <div className="bg-muted/40 text-muted-foreground w-full min-w-0 rounded-md border px-2 py-1 font-mono text-xs break-all">
            {value || '-'}
        </div>
    );
}

export function SettingsAdvancedTab({ advanced }: any) {
    const {
        prefs,
        cacheStats,
        cacheStatsVisible,
        avatarAutoCleanupOptions,
        sqliteTableSizes,
        sqliteTableSizeRows,
        onlineVisitCount,
        configTreeData,
        appDataDirState,
        tauriAppSnapshot,
        gameLogDisabledLabel,
        onRelaunchVRChatAfterCrashChange,
        onVrcQuitFixChange,
        onAutoSweepVRChatCacheChange,
        onUdonExceptionLoggingChange,
        onLogResourceLoadChange,
        onOpenShortcutFolder,
        onEnableAppLauncherChange,
        onEnableAppLauncherAutoCloseChange,
        onEnableAppLauncherRunProcessOnceChange,
        onDefaultLaunchModeChange,
        onShowConfirmationOnSwitchAvatarChange,
        onClearVrcxCache,
        onPromptAutoClearVrcxCacheFrequency,
        onRefreshCacheSize,
        onGameLogDisabledChange,
        onAvatarAutoCleanupChange,
        onOpenPurgeDialog,
        onMigrateLegacyVrcxData,
        onRefreshSqliteTableSizes,
        onRefreshOnlineVisits,
        onRefreshConfigTreeData,
        onRefreshRuntimeAppSnapshot,
        onOpenAppDataDirSelector,
        onResetAppDataDir,
        onRestartForAppDataDir,
        onClearConfigTreeData
    } = advanced;
    const { t } = useTranslation();
    const gameLogDisabledDescription = t(
        'view.settings.advanced.advanced.cache_debug.disable_gamelog_notice'
    );
    const appDataDirSourceLabel = appDataDirState
        ? t(
              `view.settings.advanced.advanced.data_directory.source_${appDataDirState.source}`
          )
        : t('common.loading');
    const appDataDirActionsDisabled = Boolean(appDataDirState?.cliOverride);

    return (
        <SettingsTabContent value="advanced">
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t(
                            'view.settings.advanced.advanced.vrchat_settings.header'
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.relaunch_vrchat.header'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.relaunch_vrchat.description'
                        )}
                    >
                        <Switch
                            checked={prefs.relaunchVRChatAfterCrash}
                            onCheckedChange={onRelaunchVRChatAfterCrashChange}
                        />
                    </Field>

                    <Field
                        label={t(
                            'view.settings.advanced.advanced.vrchat_quit_fix.header'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.vrchat_quit_fix.description'
                        )}
                    >
                        <Switch
                            checked={prefs.vrcQuitFix}
                            onCheckedChange={onVrcQuitFixChange}
                        />
                    </Field>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t(
                            'view.settings.advanced.advanced.data_directory.header'
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.data_directory.current'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.data_directory.description',
                            {
                                source: appDataDirSourceLabel
                            }
                        )}
                        controlClassName="lg:max-w-[34rem]"
                    >
                        <DataDirectoryPath value={appDataDirState?.currentDir} />
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.data_directory.default'
                        )}
                        controlClassName="lg:max-w-[34rem]"
                    >
                        <DataDirectoryPath value={appDataDirState?.defaultDir} />
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.data_directory.persisted'
                        )}
                        description={
                            appDataDirState?.cliOverride
                                ? t(
                                      'view.settings.advanced.advanced.data_directory.cli_override'
                                  )
                                : undefined
                        }
                        controlClassName="lg:max-w-[34rem]"
                    >
                        <DataDirectoryPath
                            value={
                                appDataDirState?.persistedDir ||
                                t(
                                    'view.settings.advanced.advanced.data_directory.not_set'
                                )
                            }
                        />
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.data_directory.actions'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.data_directory.restart_hint'
                        )}
                        controlClassName="flex-wrap gap-2"
                    >
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={appDataDirActionsDisabled}
                                onClick={onOpenAppDataDirSelector}
                            >
                                <FolderOpenIcon className="size-4" />
                                {t(
                                    'view.settings.advanced.advanced.data_directory.choose'
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={appDataDirActionsDisabled}
                                onClick={onResetAppDataDir}
                            >
                                <RotateCcwIcon className="size-4" />
                                {t(
                                    'view.settings.advanced.advanced.data_directory.reset'
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onRestartForAppDataDir}
                            >
                                <RefreshCwIcon className="size-4" />
                                {t(
                                    'view.settings.advanced.advanced.data_directory.restart'
                                )}
                            </Button>
                        </div>
                    </Field>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('view.settings.general.logging.header')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.cache_debug.udon_exception_logging'
                        )}
                    >
                        <Switch
                            checked={prefs.udonExceptionLogging}
                            onCheckedChange={onUdonExceptionLoggingChange}
                        />
                    </Field>
                    <Field
                        label={t('view.settings.general.logging.resource_load')}
                    >
                        <Switch
                            checked={prefs.logResourceLoad}
                            onCheckedChange={onLogResourceLoadChange}
                        />
                    </Field>
                    <Field
                        label={gameLogDisabledLabel}
                        description={gameLogDisabledDescription}
                    >
                        <Switch
                            checked={prefs.gameLogDisabled}
                            onCheckedChange={onGameLogDisabledChange}
                        />
                    </Field>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t(
                            'view.settings.advanced.advanced.app_launcher.header'
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.app_launcher.folder'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.app_launcher.folder_tooltip'
                        )}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onOpenShortcutFolder}
                        >
                            {t(
                                'view.settings.advanced.advanced.app_launcher.folder'
                            )}
                        </Button>
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.app_launcher.enable'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.app_launcher.folder_tooltip'
                        )}
                    >
                        <Switch
                            checked={prefs.enableAppLauncher}
                            onCheckedChange={onEnableAppLauncherChange}
                        />
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.app_launcher.auto_close'
                        )}
                    >
                        <Switch
                            checked={prefs.enableAppLauncherAutoClose}
                            onCheckedChange={onEnableAppLauncherAutoCloseChange}
                        />
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.app_launcher.run_process_once'
                        )}
                    >
                        <Switch
                            checked={prefs.enableAppLauncherRunProcessOnce}
                            onCheckedChange={
                                onEnableAppLauncherRunProcessOnceChange
                            }
                        />
                    </Field>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t(
                            'view.settings.advanced.advanced.launch_commands.header'
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.launch_commands.default_launch_mode'
                        )}
                    >
                        <Select
                            value={prefs.defaultLaunchMode}
                            onValueChange={onDefaultLaunchModeChange}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="vr">
                                        {t(
                                            'view.settings.advanced.advanced.launch_commands.default_launch_mode_vr'
                                        )}
                                    </SelectItem>
                                    <SelectItem value="desktop">
                                        {t(
                                            'view.settings.advanced.advanced.launch_commands.default_launch_mode_desktop'
                                        )}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field
                        label={t(
                            'view.settings.advanced.advanced.launch_commands.show_confirmation_on_switch_avatar_enable'
                        )}
                        description={t(
                            'view.settings.advanced.advanced.launch_commands.show_confirmation_on_switch_avatar_tooltip'
                        )}
                    >
                        <Switch
                            checked={prefs.showConfirmationOnSwitchAvatar}
                            onCheckedChange={
                                onShowConfirmationOnSwitchAvatarChange
                            }
                        />
                    </Field>
                </CardContent>
            </Card>
            <SettingsAdvancedDataCards
                prefs={prefs}
                cacheStats={cacheStats}
                cacheStatsVisible={cacheStatsVisible}
                avatarAutoCleanupOptions={avatarAutoCleanupOptions}
                sqliteTableSizes={sqliteTableSizes}
                sqliteTableSizeRows={sqliteTableSizeRows}
                onlineVisitCount={onlineVisitCount}
                configTreeData={configTreeData}
                tauriAppSnapshot={tauriAppSnapshot}
                onAutoSweepVRChatCacheChange={onAutoSweepVRChatCacheChange}
                onClearVrcxCache={onClearVrcxCache}
                onPromptAutoClearVrcxCacheFrequency={
                    onPromptAutoClearVrcxCacheFrequency
                }
                onRefreshCacheSize={onRefreshCacheSize}
                onAvatarAutoCleanupChange={onAvatarAutoCleanupChange}
                onOpenPurgeDialog={onOpenPurgeDialog}
                onMigrateLegacyVrcxData={onMigrateLegacyVrcxData}
                onRefreshSqliteTableSizes={onRefreshSqliteTableSizes}
                onRefreshOnlineVisits={onRefreshOnlineVisits}
                onRefreshConfigTreeData={onRefreshConfigTreeData}
                onRefreshRuntimeAppSnapshot={onRefreshRuntimeAppSnapshot}
                onClearConfigTreeData={onClearConfigTreeData}
            />
        </SettingsTabContent>
    );
}
