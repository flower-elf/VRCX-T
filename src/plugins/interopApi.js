// @ts-nocheck
import configRepository from '../services/config.js';
import vrcxJsonStorage from '../services/jsonStorage.js';

export async function initInteropApi(isVrOverlay = false) {
    if (isVrOverlay) {
        await CefSharp.BindObjectAsync('AppApiVr');
    } else {
        // #region | Init Cef C# bindings
        await CefSharp.BindObjectAsync(
            'AppApi',
            'WebApi',
            'VRCXStorage',
            'SQLite',
            'LogWatcher',
            'Discord',
            'AssetBundleManager'
        );

        await configRepository.init();
        new vrcxJsonStorage(VRCXStorage);

        AppApi.SetUserAgent();
    }
}
