import {
    BadgeCheckIcon,
    BrushIcon,
    DownloadIcon,
    EraserIcon,
    FolderOpenIcon,
    PaletteIcon,
    RefreshCwIcon,
    SquareIcon,
    Trash2Icon
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    PageBody,
    PageHeader,
    PageScaffold,
    PageTitle
} from '@/components/layout/PageScaffold';
import {
    clearCommunityThemeOverrideCss,
    deleteInstalledCommunityTheme,
    disableInstalledCommunityTheme,
    enableInstalledCommunityTheme,
    getCommunityThemeOverrideCssSnapshot,
    installCommunityTheme,
    loadCatalog,
    loadLocalCommunityThemePreview,
    saveCommunityThemeOverrideCss,
    stopLocalCommunityThemePreview
} from '@/services/communityThemeService';
import { tauriClient } from '@/platform/tauri/client';
import { isThemeDeveloperBuild } from '@/shared/buildLabel';
import {
    communityThemeControlsAccent,
    useCommunityThemeStore
} from '@/state/communityThemeStore';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shadcn/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { Textarea } from '@/ui/shadcn/textarea';

import type { CommunityThemeManifest } from './communityThemeTypes';

function ThemeTags({ tags }: { tags: string[] }) {
    return (
        <div className="flex min-w-0 flex-wrap gap-1.5">
            {tags.map((tag: any) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                </Badge>
            ))}
        </div>
    );
}

function ThemeCatalogCard({
    theme,
    active,
    installed,
    loading,
    onInstall,
    t
}: {
    theme: CommunityThemeManifest;
    active: boolean;
    installed: boolean;
    loading: boolean;
    onInstall: () => void;
    t: (key: string, options?: any) => string;
}) {
    return (
        <Card className="min-w-0">
            <CardHeader className="gap-1.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="truncate text-sm">
                            {theme.name}
                        </CardTitle>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
                            {theme.description}
                        </p>
                    </div>
                    {active ? (
                        <Badge className="shrink-0">
                            <BadgeCheckIcon data-icon="inline-start" />
                            {t('view.community_themes.status.active')}
                        </Badge>
                    ) : installed ? (
                        <Badge variant="secondary" className="shrink-0">
                            {t('view.community_themes.status.installed')}
                        </Badge>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-col gap-3">
                <div className="bg-muted overflow-hidden rounded-md border">
                    <img
                        src={theme.previewUrl}
                        alt={theme.name}
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                    />
                </div>
                <ThemeTags tags={theme.tags} />
                <div className="grid gap-1 text-xs">
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.author')}:{' '}
                        {theme.author.name} (@{theme.author.github})
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.version')}:{' '}
                        {theme.version}
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.license')}:{' '}
                        {theme.license}
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.tested_with')}:{' '}
                        {theme.testedWith}
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.remote_assets')}:{' '}
                        {theme.remoteAssets
                            ? t('view.community_themes.value.yes')
                            : t('view.community_themes.value.no')}
                    </div>
                </div>
                <Button
                    type="button"
                    size="sm"
                    className="w-fit"
                    disabled={loading}
                    onClick={onInstall}
                >
                    <DownloadIcon data-icon="inline-start" />
                    {installed
                        ? t('view.community_themes.action.update_enable')
                        : t('view.community_themes.action.install')}
                </Button>
            </CardContent>
        </Card>
    );
}

export function CommunityThemesPage() {
    const { t } = useTranslation();
    const catalog = useCommunityThemeStore((state: any) => state.catalog);
    const enabled = useCommunityThemeStore((state: any) => state.enabled);
    const installedTheme = useCommunityThemeStore(
        (state: any) => state.installedTheme
    );
    const localPreview = useCommunityThemeStore(
        (state: any) => state.localPreview
    );
    const overrideCssLength = useCommunityThemeStore(
        (state: any) => state.overrideCssLength
    );
    const loading = useCommunityThemeStore((state: any) => state.loading);
    const error = useCommunityThemeStore((state: any) => state.error);
    const [overrideDraft, setOverrideDraft] = useState('');
    const [devFolderPath, setDevFolderPath] = useState(
        localPreview?.folderPath || ''
    );
    const [devLoading, setDevLoading] = useState(false);
    const [devWatchEnabled, setDevWatchEnabled] = useState(false);
    const [devError, setDevError] = useState<string | null>(null);
    const devWatchReloadingRef = useRef(false);
    const developerToolsAvailable = isThemeDeveloperBuild();

    useEffect(() => {
        loadCatalog().catch((loadError: any) => {
            toast.error(
                loadError instanceof Error
                    ? loadError.message
                    : t('view.community_themes.toast.catalog_failed')
            );
        });
        setOverrideDraft(getCommunityThemeOverrideCssSnapshot());
    }, [t]);

    useEffect(() => {
        if (localPreview?.folderPath) {
            setDevFolderPath(localPreview.folderPath);
        }
    }, [localPreview?.folderPath]);

    useEffect(() => {
        if (
            !developerToolsAvailable ||
            !devWatchEnabled ||
            !devFolderPath.trim()
        ) {
            return undefined;
        }

        let disposed = false;
        const reloadForWatch = async () => {
            if (devWatchReloadingRef.current || disposed) {
                return;
            }

            devWatchReloadingRef.current = true;
            try {
                await loadLocalCommunityThemePreview(devFolderPath);
                if (!disposed) {
                    setDevError(null);
                }
            } catch (watchError) {
                if (!disposed) {
                    setDevError(
                        watchError instanceof Error
                            ? watchError.message
                            : t('view.community_themes.developer.load_failed')
                    );
                }
            } finally {
                devWatchReloadingRef.current = false;
            }
        };

        void reloadForWatch();
        const timer = window.setInterval(() => {
            void reloadForWatch();
        }, 1200);

        return () => {
            disposed = true;
            window.clearInterval(timer);
        };
    }, [devFolderPath, devWatchEnabled, developerToolsAvailable, t]);

    async function installTheme(theme: CommunityThemeManifest) {
        try {
            await installCommunityTheme(theme);
            toast.success(t('view.community_themes.toast.theme_enabled'));
        } catch (installError) {
            toast.error(
                installError instanceof Error
                    ? installError.message
                    : t('view.community_themes.toast.theme_failed')
            );
        }
    }

    async function disableTheme() {
        try {
            await disableInstalledCommunityTheme();
            toast.success(t('view.community_themes.toast.theme_disabled'));
        } catch (disableError) {
            toast.error(
                disableError instanceof Error
                    ? disableError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    async function deleteTheme() {
        try {
            await deleteInstalledCommunityTheme();
            toast.success(t('view.community_themes.toast.theme_deleted'));
        } catch (deleteError) {
            toast.error(
                deleteError instanceof Error
                    ? deleteError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    async function enableTheme() {
        try {
            await enableInstalledCommunityTheme();
            toast.success(t('view.community_themes.toast.theme_enabled'));
        } catch (enableError) {
            toast.error(
                enableError instanceof Error
                    ? enableError.message
                    : t('view.community_themes.toast.theme_failed')
            );
        }
    }

    async function saveOverride() {
        try {
            await saveCommunityThemeOverrideCss(overrideDraft);
            toast.success(t('view.community_themes.toast.override_saved'));
        } catch (saveError) {
            toast.error(
                saveError instanceof Error
                    ? saveError.message
                    : t('view.community_themes.toast.theme_failed')
            );
        }
    }

    async function clearOverride() {
        try {
            await clearCommunityThemeOverrideCss();
            setOverrideDraft('');
            toast.success(t('view.community_themes.toast.override_cleared'));
        } catch (clearError) {
            toast.error(
                clearError instanceof Error
                    ? clearError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    async function loadLocalPreview(folderPath = devFolderPath) {
        const nextFolderPath = folderPath.trim();
        if (!nextFolderPath) {
            return;
        }
        setDevLoading(true);
        setDevError(null);
        try {
            await loadLocalCommunityThemePreview(nextFolderPath);
            toast.success(t('view.community_themes.developer.loaded'));
        } catch (loadError) {
            const message =
                loadError instanceof Error
                    ? loadError.message
                    : t('view.community_themes.developer.load_failed');
            setDevError(message);
            toast.error(message);
        } finally {
            setDevLoading(false);
        }
    }

    async function pickLocalThemeFolder() {
        try {
            const folderPath = await tauriClient.app.OpenFolderSelectorDialog(
                devFolderPath || localPreview?.folderPath || null
            );
            if (!folderPath) {
                return;
            }
            setDevFolderPath(folderPath);
            await loadLocalPreview(folderPath);
        } catch (pickError) {
            toast.error(
                pickError instanceof Error
                    ? pickError.message
                    : t('view.community_themes.developer.load_failed')
            );
        }
    }

    async function stopLocalPreview() {
        try {
            setDevWatchEnabled(false);
            await stopLocalCommunityThemePreview();
            toast.success(t('view.community_themes.developer.stopped'));
        } catch (stopError) {
            toast.error(
                stopError instanceof Error
                    ? stopError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    const accentControlled = communityThemeControlsAccent(
        enabled,
        installedTheme,
        localPreview
    );

    return (
        <PageScaffold className="flex-1">
            <PageHeader>
                <PageTitle>{t('view.community_themes.header')}</PageTitle>
            </PageHeader>
            <PageBody>
                <Tabs
                    defaultValue="browse"
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="shrink-0 overflow-x-auto overflow-y-hidden">
                        <TabsList>
                            <TabsTrigger value="browse">
                                {t('view.community_themes.tabs.browse')}
                            </TabsTrigger>
                            <TabsTrigger value="installed">
                                {t('view.community_themes.tabs.installed')}
                            </TabsTrigger>
                            <TabsTrigger value="override">
                                {t('view.community_themes.tabs.override')}
                            </TabsTrigger>
                            {developerToolsAvailable ? (
                                <TabsTrigger value="developer">
                                    {t(
                                        'view.community_themes.tabs.developer'
                                    )}
                                </TabsTrigger>
                            ) : null}
                        </TabsList>
                    </div>
                    <TabsContent
                        value="browse"
                        className="m-0 min-h-0 flex-1 overflow-y-auto pt-3"
                    >
                        {error ? (
                            <div className="text-destructive p-2 text-sm">
                                {error}
                            </div>
                        ) : null}
                        {catalog.length ? (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {catalog.map((theme: any) => (
                                    <ThemeCatalogCard
                                        key={theme.id}
                                        theme={theme}
                                        active={
                                            enabled &&
                                            installedTheme?.themeId === theme.id
                                        }
                                        installed={
                                            installedTheme?.themeId === theme.id
                                        }
                                        loading={loading}
                                        t={t}
                                        onInstall={() => installTheme(theme)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="text-muted-foreground p-6 text-sm">
                                    {t(
                                        'view.community_themes.browse.empty'
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                    <TabsContent
                        value="installed"
                        className="m-0 min-h-0 flex-1 overflow-y-auto pt-3"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">
                                    {t(
                                        'view.community_themes.installed.header'
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 text-sm">
                                {installedTheme ? (
                                    <>
                                        <div className="grid gap-1 text-xs">
                                            <div>
                                                {t(
                                                    'view.community_themes.field.name'
                                                )}
                                                : {installedTheme.themeName}
                                            </div>
                                            <div>
                                                {t(
                                                    'view.community_themes.field.version'
                                                )}
                                                : {installedTheme.version}
                                            </div>
                                            <div>
                                                {t(
                                                    'view.community_themes.field.accent_mode'
                                                )}
                                                :{' '}
                                                {installedTheme.accentMode ===
                                                'app'
                                                    ? t(
                                                          'view.community_themes.value.yes'
                                                      )
                                                    : t(
                                                          'view.community_themes.value.no'
                                                    )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {enabled ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={disableTheme}
                                                >
                                                    <BrushIcon data-icon="inline-start" />
                                                    {t(
                                                        'view.community_themes.action.disable_theme'
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={enableTheme}
                                                >
                                                    <BrushIcon data-icon="inline-start" />
                                                    {t(
                                                        'view.community_themes.action.enable_theme'
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={deleteTheme}
                                            >
                                                <Trash2Icon data-icon="inline-start" />
                                                {t(
                                                    'view.community_themes.action.delete_theme'
                                                )}
                                            </Button>
                                        </div>
                                        {accentControlled ? (
                                            <p className="text-muted-foreground text-xs">
                                                {t(
                                                    'view.community_themes.installed.accent_controlled'
                                                )}
                                            </p>
                                        ) : null}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        {t(
                                            'view.community_themes.installed.empty'
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent
                        value="override"
                        className="m-0 min-h-0 flex-1 overflow-y-auto pt-3"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">
                                    {t('view.community_themes.override.header')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Textarea
                                    className="min-h-72 font-mono text-xs"
                                    spellCheck={false}
                                    value={overrideDraft}
                                    placeholder={t(
                                        'view.community_themes.override.placeholder'
                                    )}
                                    onChange={(event: any) =>
                                        setOverrideDraft(event.target.value)
                                    }
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={saveOverride}
                                    >
                                        <PaletteIcon data-icon="inline-start" />
                                        {t(
                                            'view.community_themes.action.apply_override'
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!overrideCssLength}
                                        onClick={clearOverride}
                                    >
                                        <EraserIcon data-icon="inline-start" />
                                        {t(
                                            'view.community_themes.action.clear_override'
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {developerToolsAvailable ? (
                        <TabsContent
                            value="developer"
                            className="m-0 min-h-0 flex-1 overflow-y-auto pt-3"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">
                                        {t(
                                            'view.community_themes.developer.header'
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3 text-sm">
                                    <p className="text-muted-foreground text-xs">
                                        {t(
                                            'view.community_themes.developer.description'
                                        )}
                                    </p>
                                    <div className="border-input bg-muted/30 min-h-9 rounded-md border px-3 py-2 font-mono text-xs break-all">
                                        {devFolderPath ||
                                            t(
                                                'view.community_themes.developer.no_folder'
                                            )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={devLoading}
                                            onClick={pickLocalThemeFolder}
                                        >
                                            <FolderOpenIcon data-icon="inline-start" />
                                            {t(
                                                'view.community_themes.developer.select_folder'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                devLoading ||
                                                !devFolderPath.trim()
                                            }
                                            onClick={() => loadLocalPreview()}
                                        >
                                            <RefreshCwIcon data-icon="inline-start" />
                                            {t(
                                                'view.community_themes.developer.reload'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={
                                                devWatchEnabled
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            disabled={!devFolderPath.trim()}
                                            onClick={() =>
                                                setDevWatchEnabled(
                                                    (value) => !value
                                                )
                                            }
                                        >
                                            <RefreshCwIcon data-icon="inline-start" />
                                            {t(
                                                devWatchEnabled
                                                    ? 'view.community_themes.developer.stop_watch'
                                                    : 'view.community_themes.developer.start_watch'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!localPreview}
                                            onClick={stopLocalPreview}
                                        >
                                            <SquareIcon data-icon="inline-start" />
                                            {t(
                                                'view.community_themes.developer.stop_preview'
                                            )}
                                        </Button>
                                    </div>
                                    {devError ? (
                                        <p className="text-destructive text-xs">
                                            {devError}
                                        </p>
                                    ) : null}
                                    {localPreview ? (
                                        <div className="grid gap-1 text-xs">
                                            <div>
                                                {t(
                                                    'view.community_themes.field.name'
                                                )}
                                                : {localPreview.themeName}
                                            </div>
                                            <div>
                                                {t(
                                                    'view.community_themes.field.version'
                                                )}
                                                : {localPreview.version || '-'}
                                            </div>
                                            <div>
                                                {t(
                                                    'view.community_themes.field.accent_mode'
                                                )}
                                                :{' '}
                                                {localPreview.accentMode ===
                                                'app'
                                                    ? t(
                                                          'view.community_themes.value.yes'
                                                      )
                                                    : t(
                                                          'view.community_themes.value.no'
                                                      )}
                                            </div>
                                            <div>
                                                {t(
                                                    'view.community_themes.developer.css_size'
                                                )}
                                                : {localPreview.cssLength}
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ) : null}
                </Tabs>
            </PageBody>
        </PageScaffold>
    );
}
