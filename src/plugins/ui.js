import {
    applyAppCjkFontPack,
    applyAppFontFamily,
    changeAppThemeStyle,
    changeHtmlLangAttribute,
    getThemeMode,
    initThemeColor,
    refreshCustomCss
} from '../shared/utils/base/ui';
import {
    APP_CJK_FONT_PACK_DEFAULT_KEY,
    APP_FONT_DEFAULT_KEY
} from '../shared/constants';
import { i18n, loadLocalizedStrings } from './i18n';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import configRepository from '../services/config';

const ZOOM_KEY = 'VRCX_ZoomLevel';

export async function initUi() {
    try {
        const [
            language,
            appFontFamily,
            customFontFamily,
            appCjkFontPack,
            savedZoom
        ] = await Promise.all([
            configRepository.getString('VRCX_appLanguage', 'en'),
            configRepository.getString(
                'VRCX_fontFamily',
                APP_FONT_DEFAULT_KEY
            ),
            configRepository.getString('customFontFamily', ''),
            configRepository.getString(
                'VRCX_cjkFontPack',
                APP_CJK_FONT_PACK_DEFAULT_KEY
            ),
            configRepository.getString(ZOOM_KEY, null)
        ]);

        // @ts-ignore
        i18n.locale = language;
        await loadLocalizedStrings(language);
        changeHtmlLangAttribute(language);

        const { initThemeMode } = await getThemeMode(configRepository);
        changeAppThemeStyle(initThemeMode);
        await initThemeColor();

        applyAppFontFamily(appFontFamily, customFontFamily);
        applyAppCjkFontPack(appCjkFontPack);

        if (!navigator.platform.includes('Mac') && savedZoom !== null) {
            const level = Number(savedZoom);
            if (Number.isFinite(level)) {
                await getCurrentWebviewWindow().setZoom(
                    Math.pow(1.2, level / 10 - 10)
                );
            }
        }
    } catch (error) {
        console.error('Error initializing locale and theme:', error);
    }

    refreshCustomCss();
}
