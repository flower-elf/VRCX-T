import type {
    CommunityThemeInstallMetadata,
    CommunityThemeManifest
} from '@/features/community-themes/communityThemeTypes';
import {
    loadCommunityThemeCss,
    loadCommunityThemeCssById
} from '@/repositories/communityThemeRepository';

import {
    isNasaApodWallpaperCssSnapshotAllowed,
    isNasaApodWallpaperThemeId,
    resolveNasaApodWallpaperCss
} from './community-theme-providers/nasaApodWallpaperProvider';

export function hasDynamicCommunityThemeProvider(themeId: string): boolean {
    return isNasaApodWallpaperThemeId(themeId);
}

export function isDynamicCommunityThemeCssSnapshotAllowed(
    themeId: string,
    cssText: string
): boolean {
    if (isNasaApodWallpaperThemeId(themeId)) {
        return isNasaApodWallpaperCssSnapshotAllowed(cssText);
    }
    return true;
}

async function resolveDynamicCommunityThemeCss(
    themeId: string,
    cssTemplate: string
): Promise<string> {
    if (isNasaApodWallpaperThemeId(themeId)) {
        return resolveNasaApodWallpaperCss(cssTemplate);
    }
    return cssTemplate;
}

export async function resolveCommunityThemeCssSnapshot(
    catalogUrl: string,
    theme: CommunityThemeManifest
): Promise<string> {
    const cssTemplate = await loadCommunityThemeCss(catalogUrl, theme);
    return resolveDynamicCommunityThemeCss(theme.id, cssTemplate);
}

export async function refreshDynamicCommunityThemeCssSnapshot(
    catalogUrl: string,
    metadata: CommunityThemeInstallMetadata
): Promise<string | null> {
    if (!hasDynamicCommunityThemeProvider(metadata.themeId)) {
        return null;
    }

    const cssTemplate = await loadCommunityThemeCssById(
        catalogUrl,
        metadata.themeId
    );
    return resolveDynamicCommunityThemeCss(metadata.themeId, cssTemplate);
}
