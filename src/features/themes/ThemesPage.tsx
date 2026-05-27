import {
    BadgeCheckIcon,
    BrushIcon,
    ChevronDownIcon,
    CodeIcon,
    DownloadIcon,
    EraserIcon,
    ExternalLinkIcon,
    FolderOpenIcon,
    PaletteIcon,
    RefreshCwIcon,
    SquareIcon,
    Trash2Icon
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import {
    PageBody,
    PageHeader,
    PageScaffold,
    PageTitle
} from '@/components/layout/PageScaffold';
import {
    clearCommunityThemeOverrideCss,
    deleteInstalledCommunityTheme,
    disableCommunityThemeOverrideCss,
    disableInstalledCommunityTheme,
    enableInstalledCommunityTheme,
    getCommunityThemeOverrideCssSnapshot,
    installCommunityTheme,
    loadCatalog,
    loadLocalCommunityThemePreview,
    saveCommunityThemeOverrideCss,
    stopLocalCommunityThemePreview
} from '@/services/communityThemeService';
import {
    disableBackgroundImage,
    setBackgroundImageMode
} from '@/services/background-image/backgroundImageService';
import { openExternalLink } from '@/services/entityMediaService';
import { tauriClient } from '@/platform/tauri/client';
import {
    loadCommunityThemeStats,
    reportCommunityThemeInstall
} from '@/repositories/communityThemeRepository';
import type {
    CommunityThemeStatsById
} from '@/repositories/communityThemeRepository';
import {
    setThemeColorPreference,
    setThemeModePreference
} from '@/services/preferencesService';
import { isThemeDeveloperBuild } from '@/shared/buildLabel';
import { THEME_COLORS } from '@/shared/constants/themes';
import type { BackgroundImageMode } from '@/services/background-image/types';
import { useBackgroundImageStore } from '@/state/backgroundImageStore';
import {
    communityThemeControlsAccent,
    useCommunityThemeStore
} from '@/state/communityThemeStore';
import { useShellStore } from '@/state/shellStore';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shadcn/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/ui/shadcn/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shadcn/tabs';
import { Textarea } from '@/ui/shadcn/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/ui/shadcn/tooltip';

import { BackgroundImageSection } from './components/BackgroundImageSection';

import type {
    CommunityThemeInstallMetadata,
    CommunityThemeManifest
} from './communityThemeTypes';

type ThemeSource = 'built-in' | 'background' | 'community';

const THEME_MODE_OPTIONS = ['system', 'light', 'dark'];
const COMMUNITY_THEMES_REPOSITORY_URL =
    'https://github.com/Map1en/VRCX-0-Community-Themes';

function themeModeLabel(themeMode: string, t: (key: string) => string) {
    return t(`view.settings.appearance.appearance.theme_mode_${themeMode}`);
}

function themeColorLabel(themeColor: any, t: (key: string) => string) {
    return t(`view.settings.appearance.theme_color.${themeColor.key}`);
}

function resolveActiveThemeSource(
    backgroundImageEnabled: boolean,
    communityThemeEnabled: boolean,
    localPreview: unknown
): ThemeSource {
    if (localPreview || communityThemeEnabled) {
        return 'community';
    }
    if (backgroundImageEnabled) {
        return 'background';
    }
    return 'built-in';
}

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

function ThemeSourceButton({
    active,
    children,
    onClick
}: {
    active: boolean;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'outline'}
            size="sm"
            className="h-7 justify-start gap-1.5 rounded-md px-2.5"
            onClick={onClick}
        >
            {active ? <BadgeCheckIcon data-icon="inline-start" /> : null}
            {children}
        </Button>
    );
}

function normalizeVersionForThemeCompatibility(version: string): string {
    return String(version || '')
        .trim()
        .replace(/^v/i, '');
}

function isSameThemeVersion(left: string, right: string): boolean {
    return (
        normalizeVersionForThemeCompatibility(left) ===
        normalizeVersionForThemeCompatibility(right)
    );
}

function resolveThemeAuthorUrl(theme: CommunityThemeManifest): string {
    const authorUrl = theme.author.url?.trim();
    if (authorUrl) {
        return authorUrl;
    }
    return `https://github.com/${theme.author.github}`;
}

function ThemeCatalogCard({
    theme,
    active,
    installed,
    updateAvailable,
    downloads,
    loading,
    onInstall,
    t
}: {
    theme: CommunityThemeManifest;
    active: boolean;
    installed: boolean;
    updateAvailable: boolean;
    downloads: number;
    loading: boolean;
    onInstall: () => void;
    t: (key: string, options?: any) => string;
}) {
    const authorUrl = resolveThemeAuthorUrl(theme);

    return (
        <Card
            size="sm"
            className={`min-w-0 ${active && !updateAvailable ? 'opacity-70' : ''}`}
        >
            <CardHeader className="gap-1.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="truncate text-sm">
                            {theme.name}
                        </CardTitle>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p className="text-muted-foreground mt-1 line-clamp-2 h-8 text-xs leading-4">
                                    {theme.description}
                                </p>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">
                                {theme.description}
                            </TooltipContent>
                        </Tooltip>
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
            <CardContent className="flex min-h-0 flex-col gap-2.5">
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
                        <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="inline-flex h-auto max-w-full justify-start gap-1 p-0 align-baseline text-xs font-normal"
                            title={authorUrl}
                            onClick={() => {
                                void openExternalLink(authorUrl);
                            }}
                        >
                            <span className="truncate">{theme.author.name}</span>
                            <ExternalLinkIcon data-icon="inline-end" />
                        </Button>
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.version')}:{' '}
                        {theme.version}
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.tested_with')}:{' '}
                        {theme.testedWith}
                    </div>
                    <div className="text-muted-foreground">
                        {t('view.community_themes.field.downloads')}:{' '}
                        {downloads.toLocaleString()}
                    </div>
                </div>
                <Button
                    type="button"
                    size="sm"
                    className="w-fit"
                    variant={active && !updateAvailable ? 'outline' : 'default'}
                    disabled={loading || (active && !updateAvailable)}
                    onClick={onInstall}
                >
                    {active && !updateAvailable ? (
                        <BadgeCheckIcon data-icon="inline-start" />
                    ) : (
                        <DownloadIcon data-icon="inline-start" />
                    )}
                    {updateAvailable
                        ? t('view.community_themes.action.update_enable')
                        : installed
                          ? active
                              ? t('view.community_themes.status.active')
                              : t('view.community_themes.action.enable_theme')
                          : t('view.community_themes.action.install')}
                </Button>
            </CardContent>
        </Card>
    );
}

export function ThemesPage() {
    const { t } = useTranslation();
    const themeMode = useShellStore((state: any) => state.themeMode);
    const themeColor = useShellStore((state: any) => state.themeColor);
    const backgroundImageEnabled = useBackgroundImageStore(
        (state: any) => state.enabled
    );
    const backgroundImageMode = useBackgroundImageStore(
        (state: any) => state.mode
    );
    const backgroundImageCustomSource = useBackgroundImageStore(
        (state: any) => state.customSource
    );
    const catalog = useCommunityThemeStore((state: any) => state.catalog);
    const enabled = useCommunityThemeStore((state: any) => state.enabled);
    const installedTheme = useCommunityThemeStore(
        (state: any) => state.installedTheme
    );
    const installedThemes = useCommunityThemeStore(
        (state: any) => state.installedThemes
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
    const [customCssOpen, setCustomCssOpen] = useState(
        Boolean(overrideCssLength)
    );
    const [devFolderPath, setDevFolderPath] = useState(
        localPreview?.folderPath || ''
    );
    const [devLoading, setDevLoading] = useState(false);
    const [devSectionOpen, setDevSectionOpen] = useState(false);
    const [devWatchEnabled, setDevWatchEnabled] = useState(false);
    const [devError, setDevError] = useState<string | null>(null);
    const [themeStatsById, setThemeStatsById] =
        useState<CommunityThemeStatsById>({});
    const devWatchReloadingRef = useRef(false);
    const developerToolsAvailable = isThemeDeveloperBuild();
    const activeSource = resolveActiveThemeSource(
        backgroundImageEnabled,
        enabled,
        localPreview
    );
    const [selectedSource, setSelectedSource] =
        useState<ThemeSource>(activeSource);
    const visibleSource =
        activeSource === 'built-in' ? selectedSource : activeSource;

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
        let disposed = false;
        loadCommunityThemeStats()
            .then((stats) => {
                if (!disposed) {
                    setThemeStatsById(stats);
                }
            })
            .catch(() => {
                if (!disposed) {
                    setThemeStatsById({});
                }
            });

        return () => {
            disposed = true;
        };
    }, []);

    useEffect(() => {
        if (activeSource !== 'built-in') {
            setSelectedSource(activeSource);
        }
    }, [activeSource]);

    useEffect(() => {
        if (localPreview?.folderPath) {
            setDevFolderPath(localPreview.folderPath);
        }
    }, [localPreview?.folderPath]);

    useEffect(() => {
        if (overrideCssLength) {
            setCustomCssOpen(true);
        }
    }, [overrideCssLength]);

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
            void reportCommunityThemeInstall(theme.id).then((reported) => {
                if (!reported) {
                    return;
                }
                setThemeStatsById((currentStats) => ({
                    ...currentStats,
                    [theme.id]: {
                        downloads:
                            (currentStats[theme.id]?.downloads ?? 0) + 1
                    }
                }));
            });
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

    async function deleteTheme(themeId?: string) {
        try {
            await deleteInstalledCommunityTheme(themeId);
            toast.success(t('view.community_themes.toast.theme_deleted'));
        } catch (deleteError) {
            toast.error(
                deleteError instanceof Error
                    ? deleteError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    async function enableTheme(themeId?: string) {
        try {
            await enableInstalledCommunityTheme(themeId);
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

    async function disableOverride() {
        try {
            await disableCommunityThemeOverrideCss();
            toast.success(t('view.community_themes.toast.override_disabled'));
        } catch (disableError) {
            toast.error(
                disableError instanceof Error
                    ? disableError.message
                    : t('view.community_themes.toast.disable_failed')
            );
        }
    }

    async function selectBuiltInSource() {
        setSelectedSource('built-in');
        try {
            if (backgroundImageEnabled) {
                await disableBackgroundImage();
            }
            if (enabled) {
                await disableInstalledCommunityTheme();
            }
            if (localPreview) {
                await stopLocalCommunityThemePreview();
            }
            toast.success(t('view.themes.toast.built_in_enabled'));
        } catch (sourceError) {
            toast.error(
                sourceError instanceof Error
                    ? sourceError.message
                    : t('view.themes.toast.source_failed')
            );
        }
    }

    async function selectBackgroundSource() {
        setSelectedSource('background');
        try {
            const nextMode: BackgroundImageMode =
                backgroundImageMode === 'custom' && backgroundImageCustomSource
                    ? 'custom'
                    : 'daily';
            const updated = await setBackgroundImageMode(nextMode);
            if (updated) {
                toast.success(t('view.background_image.toast.enabled'));
            }
        } catch (sourceError) {
            toast.error(
                sourceError instanceof Error
                    ? sourceError.message
                    : t('view.background_image.toast.failed')
            );
        }
    }

    async function selectCommunitySource() {
        setSelectedSource('community');
        try {
            if (backgroundImageEnabled) {
                await disableBackgroundImage({ restoreAppTheme: false });
            }
            if (!enabled && installedTheme) {
                await enableInstalledCommunityTheme(installedTheme.themeId);
            }
        } catch (sourceError) {
            toast.error(
                sourceError instanceof Error
                    ? sourceError.message
                    : t('view.community_themes.toast.theme_failed')
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
    const installedThemeById = new Map<string, CommunityThemeInstallMetadata>(
        installedThemes.map((theme: CommunityThemeInstallMetadata) => [
            theme.themeId,
            theme
        ])
    );
    const appearanceControlled = activeSource !== 'built-in';
    const customCssBadge = overrideCssLength
        ? t('view.themes.summary.custom_css_on')
        : '';

    async function updateThemeMode(nextThemeMode: string) {
        if (appearanceControlled) {
            return;
        }
        try {
            await setThemeModePreference(nextThemeMode);
        } catch (modeError) {
            toast.error(
                modeError instanceof Error
                    ? modeError.message
                    : t('view.themes.toast.source_failed')
            );
        }
    }

    async function updateThemeColor(nextThemeColor: string) {
        if (accentControlled) {
            return;
        }
        try {
            await setThemeColorPreference(nextThemeColor);
        } catch (colorError) {
            toast.error(
                colorError instanceof Error
                    ? colorError.message
                    : t('view.themes.toast.source_failed')
            );
        }
    }

    return (
        <PageScaffold className="flex-1">
            <PageHeader>
                <PageTitle>{t('view.themes.header')}</PageTitle>
            </PageHeader>
            <PageBody>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
                        <div className="border-border/70 bg-card/70 flex min-w-0 flex-col gap-3 rounded-lg border px-3 py-2.5">
                            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div className="grid min-w-0 gap-1">
                                    <div className="text-sm font-medium">
                                        {t('view.themes.summary.header')}
                                    </div>
                                    {customCssBadge ? (
                                        <div>
                                            <Badge
                                                variant="secondary"
                                                className="h-5 rounded-md px-1.5 text-xs font-normal"
                                            >
                                                {customCssBadge}
                                            </Badge>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex min-w-0 flex-wrap gap-1 rounded-lg bg-muted/30 p-1">
                                    <ThemeSourceButton
                                        active={visibleSource === 'built-in'}
                                        onClick={selectBuiltInSource}
                                    >
                                        {t('view.themes.source.built_in')}
                                    </ThemeSourceButton>
                                    <ThemeSourceButton
                                        active={visibleSource === 'background'}
                                        onClick={selectBackgroundSource}
                                    >
                                        {t('view.themes.source.background')}
                                    </ThemeSourceButton>
                                    <ThemeSourceButton
                                        active={visibleSource === 'community'}
                                        onClick={selectCommunitySource}
                                    >
                                        {t('view.themes.source.community')}
                                    </ThemeSourceButton>
                                </div>
                            </div>

                            {visibleSource === 'built-in' ? (
                                <div className="border-border/70 flex min-w-0 flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-muted-foreground text-xs">
                                        {t(
                                            'view.themes.source.built_in_description'
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {THEME_MODE_OPTIONS.map((mode) => (
                                            <Button
                                                key={mode}
                                                type="button"
                                                size="sm"
                                                variant={
                                                    themeMode === mode
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                className="h-7"
                                                onClick={() =>
                                                    updateThemeMode(mode)
                                                }
                                            >
                                                {themeModeLabel(mode, t)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {visibleSource === 'background' ? (
                            <BackgroundImageSection />
                        ) : null}

                        {visibleSource === 'community' ? (
                            <Tabs
                                defaultValue="browse"
                                className="flex min-h-0 flex-col gap-3"
                            >
                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="shrink-0 overflow-x-auto overflow-y-hidden">
                                        <TabsList>
                                            <TabsTrigger value="browse">
                                                {t(
                                                    'view.community_themes.tabs.browse'
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="installed">
                                                {t(
                                                    'view.community_themes.tabs.installed'
                                                )}
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-fit shrink-0"
                                                onClick={() => {
                                                    void openExternalLink(
                                                        COMMUNITY_THEMES_REPOSITORY_URL
                                                    );
                                                }}
                                            >
                                                <ExternalLinkIcon data-icon="inline-start" />
                                                {t(
                                                    'view.community_themes.action.contribute'
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t(
                                                'view.community_themes.action.contribute_tooltip'
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <TabsContent value="browse" className="m-0">
                                    {error ? (
                                        <div className="text-destructive p-2 text-sm">
                                            {error}
                                        </div>
                                    ) : null}
                                    {catalog.length ? (
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,16rem))] justify-start gap-2">
                                            {catalog.map((theme: any) => {
                                                const installedEntry =
                                                    installedThemeById.get(
                                                        theme.id
                                                    );
                                                const active =
                                                    enabled &&
                                                    installedTheme?.themeId ===
                                                        theme.id;
                                                const updateAvailable = Boolean(
                                                    installedEntry &&
                                                        !isSameThemeVersion(
                                                            installedEntry.version,
                                                            theme.version
                                                        )
                                                );
                                                return (
                                                    <ThemeCatalogCard
                                                        key={theme.id}
                                                        theme={theme}
                                                        active={active}
                                                        installed={Boolean(
                                                            installedEntry
                                                        )}
                                                        updateAvailable={
                                                            updateAvailable
                                                        }
                                                        downloads={
                                                            themeStatsById[
                                                                theme.id
                                                            ]?.downloads ?? 0
                                                        }
                                                        loading={loading}
                                                        t={t}
                                                        onInstall={() => {
                                                            if (
                                                                installedEntry &&
                                                                !updateAvailable
                                                            ) {
                                                                enableTheme(
                                                                    theme.id
                                                                );
                                                                return;
                                                            }
                                                            installTheme(theme);
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="border-border/70 text-muted-foreground rounded-lg border p-4 text-sm">
                                            {t(
                                                'view.community_themes.browse.empty'
                                            )}
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="installed" className="m-0">
                                    <div className="border-border/70 bg-card/70 rounded-lg border p-3">
                                        <div className="mb-3 text-sm font-medium">
                                            {t(
                                                'view.community_themes.installed.header'
                                            )}
                                        </div>
                                        {installedThemes.length ? (
                                            <div className="grid gap-2">
                                                {installedThemes.map(
                                                    (
                                                        theme: CommunityThemeInstallMetadata
                                                    ) => {
                                                        const active =
                                                            enabled &&
                                                            installedTheme?.themeId ===
                                                                theme.themeId;
                                                        return (
                                                            <div
                                                                key={
                                                                    theme.themeId
                                                                }
                                                                className="border-border/70 bg-muted/20 min-w-0 rounded-md border p-3"
                                                            >
                                                                <div className="flex flex-col gap-3 text-sm">
                                                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                                                        <div className="grid min-w-0 gap-1 text-xs">
                                                                            <div className="font-medium">
                                                                                {
                                                                                    theme.themeName
                                                                                }
                                                                            </div>
                                                                            <div className="text-muted-foreground">
                                                                                {t(
                                                                                    'view.community_themes.field.version'
                                                                                )}
                                                                                :{' '}
                                                                                {
                                                                                    theme.version
                                                                                }
                                                                            </div>
                                                                            <div className="text-muted-foreground">
                                                                                {t(
                                                                                    'view.community_themes.field.accent_mode'
                                                                                )}
                                                                                :{' '}
                                                                                {theme.accentMode
                                                                                    ? t(
                                                                                          'view.community_themes.value.yes'
                                                                                      )
                                                                                    : t(
                                                                                          'view.community_themes.value.no'
                                                                                      )}
                                                                            </div>
                                                                        </div>
                                                                        {active ? (
                                                                            <Badge className="shrink-0">
                                                                                <BadgeCheckIcon data-icon="inline-start" />
                                                                                {t(
                                                                                    'view.community_themes.status.active'
                                                                                )}
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {active ? (
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={
                                                                                    disableTheme
                                                                                }
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
                                                                                onClick={() =>
                                                                                    enableTheme(
                                                                                        theme.themeId
                                                                                    )
                                                                                }
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
                                                                            onClick={() =>
                                                                                deleteTheme(
                                                                                    theme.themeId
                                                                                )
                                                                            }
                                                                        >
                                                                            <Trash2Icon data-icon="inline-start" />
                                                                            {t(
                                                                                'view.community_themes.action.delete_theme'
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                    {active &&
                                                                    accentControlled ? (
                                                                        <p className="text-muted-foreground text-xs">
                                                                            {t(
                                                                                'view.community_themes.installed.accent_controlled'
                                                                            )}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                {t(
                                                    'view.community_themes.installed.empty'
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        ) : null}

                        <div className="border-border/70 bg-card/60 flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2.5">
                            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm font-medium">
                                    {t('view.themes.accent.header')}
                                </div>
                                {accentControlled ? (
                                    <p className="text-muted-foreground text-xs">
                                        {t(
                                            'view.community_themes.installed.accent_controlled'
                                        )}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {THEME_COLORS.map((color: any) => (
                                    <Button
                                        key={color.key}
                                        type="button"
                                        size="sm"
                                        variant={
                                            themeColor === color.key
                                                ? 'default'
                                                : 'outline'
                                        }
                                        className="h-7"
                                        disabled={accentControlled}
                                        onClick={() =>
                                            updateThemeColor(color.key)
                                        }
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="border-foreground/10 size-2.5 shrink-0 rounded-full border"
                                            style={{
                                                backgroundColor: color.swatch
                                            }}
                                        />
                                        {themeColorLabel(color, t)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Collapsible
                            open={customCssOpen}
                            onOpenChange={setCustomCssOpen}
                            className="border-border/70 bg-card/50 rounded-lg border px-3 py-2.5"
                        >
                            <div className="flex flex-col gap-3">
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="grid min-w-0 gap-1">
                                            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                                <CodeIcon data-icon="inline-start" />
                                                {t('view.themes.custom_css.header')}
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                {overrideCssLength
                                                    ? t(
                                                          'view.themes.custom_css.enabled_summary',
                                                          {
                                                              count: overrideCssLength
                                                          }
                                                      )
                                                    : t(
                                                          'view.themes.custom_css.disabled_summary'
                                                      )}
                                            </div>
                                        </div>
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 shrink-0"
                                            >
                                                {t(
                                                    customCssOpen
                                                        ? 'view.themes.custom_css.hide_editor'
                                                        : 'view.themes.custom_css.edit'
                                                )}
                                                <ChevronDownIcon
                                                    data-icon="inline-end"
                                                    className={cn(
                                                        'opacity-60 transition-transform',
                                                        customCssOpen &&
                                                            'rotate-180'
                                                    )}
                                                />
                                            </Button>
                                        </CollapsibleTrigger>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="flex flex-col gap-3 border-t pt-3">
                                            <Textarea
                                                className="min-h-56 font-mono text-xs"
                                                spellCheck={false}
                                                value={overrideDraft}
                                                placeholder={t(
                                                    'view.community_themes.override.placeholder'
                                                )}
                                                onChange={(event: any) =>
                                                    setOverrideDraft(
                                                        event.target.value
                                                    )
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
                                                    onClick={disableOverride}
                                                >
                                                    <SquareIcon data-icon="inline-start" />
                                                    {t(
                                                        'view.community_themes.action.disable_override'
                                                    )}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        !overrideDraft.trim()
                                                    }
                                                    onClick={clearOverride}
                                                >
                                                    <EraserIcon data-icon="inline-start" />
                                                    {t(
                                                        'view.community_themes.action.clear_override'
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                            </div>
                        </Collapsible>

                        {developerToolsAvailable ? (
                            <Collapsible
                                open={devSectionOpen}
                                onOpenChange={setDevSectionOpen}
                                className="border-border/70 bg-card/50 rounded-lg border px-3 py-2.5"
                            >
                                <div className="flex flex-col gap-3 text-sm">
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="grid min-w-0 gap-1">
                                                <div className="text-sm font-medium">
                                                    {t(
                                                        'view.community_themes.developer.header'
                                                    )}
                                                </div>
                                                <div className="text-muted-foreground text-xs">
                                                    {localPreview
                                                        ? t(
                                                              'view.themes.developer.preview_active',
                                                              {
                                                                  name: localPreview.themeName
                                                              }
                                                          )
                                                        : t(
                                                              'view.themes.developer.summary'
                                                          )}
                                                </div>
                                            </div>
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 shrink-0"
                                                >
                                                    {t(
                                                        devSectionOpen
                                                            ? 'view.themes.developer.hide'
                                                            : 'view.themes.developer.show'
                                                    )}
                                                    <ChevronDownIcon
                                                        data-icon="inline-end"
                                                        className={cn(
                                                            'opacity-60 transition-transform',
                                                            devSectionOpen &&
                                                                'rotate-180'
                                                        )}
                                                    />
                                                </Button>
                                            </CollapsibleTrigger>
                                        </div>
                                        <CollapsibleContent>
                                            <div className="flex flex-col gap-3 border-t pt-3">
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
                                                        onClick={
                                                            pickLocalThemeFolder
                                                        }
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
                                                        onClick={() =>
                                                            loadLocalPreview()
                                                        }
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
                                                        disabled={
                                                            !devFolderPath.trim()
                                                        }
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
                                                            :{' '}
                                                            {
                                                                localPreview.themeName
                                                            }
                                                        </div>
                                                        <div>
                                                            {t(
                                                                'view.community_themes.field.version'
                                                            )}
                                                            :{' '}
                                                            {localPreview.version ||
                                                                '-'}
                                                        </div>
                                                        <div>
                                                            {t(
                                                                'view.community_themes.field.accent_mode'
                                                            )}
                                                            :{' '}
                                                            {localPreview.accentMode
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
                                                            :{' '}
                                                            {
                                                                localPreview.cssLength
                                                            }
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </CollapsibleContent>
                                </div>
                            </Collapsible>
                        ) : null}
                    </div>
                </div>
            </PageBody>
        </PageScaffold>
    );
}
