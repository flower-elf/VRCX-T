export type VrcxBuildLabel = 'preview' | 'theme-devkit' | 'test' | string;

const PREVIEW_LABELS = new Set(['preview', 'test']);
const THEME_DEVKIT_LABEL = 'theme-devkit';

export function getVrcxBuildLabel(): VrcxBuildLabel {
    // oxlint-disable-next-line no-undef
    return typeof VRCX_0_BUILD_LABEL === 'string'
        ? VRCX_0_BUILD_LABEL.trim().toLowerCase()
        : '';
}

export function isLocalDevBuild(): boolean {
    return import.meta.env.DEV;
}

export function isPreviewBuildLabel(label = getVrcxBuildLabel()): boolean {
    return PREVIEW_LABELS.has(label);
}

export function isThemeDevKitBuildLabel(
    label = getVrcxBuildLabel()
): boolean {
    return label === THEME_DEVKIT_LABEL;
}

export function isThemeDeveloperBuild(): boolean {
    const label = getVrcxBuildLabel();
    return (
        isLocalDevBuild() ||
        isPreviewBuildLabel(label) ||
        isThemeDevKitBuildLabel(label)
    );
}

export function getBuildBadgeI18nKey(): string | null {
    const label = getVrcxBuildLabel();
    if (isThemeDevKitBuildLabel(label)) {
        return 'app_menu.theme_devkit_build_badge';
    }
    if (isPreviewBuildLabel(label)) {
        return 'app_menu.preview_build_badge';
    }
    return null;
}
