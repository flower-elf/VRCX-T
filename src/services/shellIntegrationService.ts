import {
    tauriClient,
    type AppDataDirState,
    type AppDataDirValidation
} from '@/platform/tauri/client';

export async function openExternalLink(url: string): Promise<void> {
    await tauriClient.app.OpenLink(url);
}

export async function exitApplication(): Promise<void> {
    await tauriClient.app.ExitApplication();
}

export async function restartApplication(): Promise<void> {
    await tauriClient.app.RestartApplication();
}

export async function getAppDataDirState(): Promise<AppDataDirState> {
    return tauriClient.app.GetAppDataDirState();
}

export async function validateAppDataDir(
    path: string
): Promise<AppDataDirValidation> {
    return tauriClient.app.ValidateAppDataDir(path);
}

export async function setAppDataDir(path: string): Promise<AppDataDirState> {
    return tauriClient.app.SetAppDataDir(path);
}

export async function clearAppDataDir(): Promise<AppDataDirState> {
    return tauriClient.app.ClearAppDataDir();
}

export async function getClipboardText(): Promise<string> {
    const value = await tauriClient.app.GetClipboard().catch(() => '');
    return typeof value === 'string' ? value : '';
}

export async function setTrayIconNotification(
    notify: boolean
): Promise<void> {
    await tauriClient.app.SetTrayIconNotification(notify);
}

export async function showDesktopNotification(
    boldText: string,
    text: string,
    image: string = '',
    playSound: boolean = false
): Promise<void> {
    await tauriClient.app.DesktopNotification(
        boldText,
        text,
        image,
        playSound
    );
}

export async function openUGCPhotosFolder(ugcPath: string): Promise<void> {
    await tauriClient.app.OpenUGCPhotosFolder(ugcPath);
}

export async function openFolderAndSelectItem(
    path: string,
    isFolder: boolean
): Promise<void> {
    await tauriClient.app.OpenFolderAndSelectItem(path, isFolder);
}

export async function openFolderSelectorDialog(
    defaultPath: string
): Promise<string> {
    const selected = await tauriClient.app.OpenFolderSelectorDialog(defaultPath);
    return typeof selected === 'string' ? selected : '';
}

export async function openFileSelectorDialog(
    defaultPath: string,
    defaultExt: string,
    defaultFilter: string
): Promise<string> {
    const selected = await tauriClient.app.OpenFileSelectorDialog(
        defaultPath,
        defaultExt,
        defaultFilter
    );
    return typeof selected === 'string' ? selected : '';
}

export async function openCalendarFile(icsContent: string): Promise<void> {
    await tauriClient.app.OpenCalendarFile(icsContent);
}

export async function saveCalendarFile(
    defaultName: string,
    icsContent: string
): Promise<void> {
    await tauriClient.app.SaveCalendarFile(defaultName, icsContent);
}

export async function readVrchatConfigFileSafe(): Promise<string> {
    const config = await tauriClient.app.ReadConfigFileSafe();
    return typeof config === 'string' ? config : '';
}

export async function writeVrchatConfigFile(json: string): Promise<void> {
    await tauriClient.app.WriteConfigFile(json);
}

export async function setVrchatRegistryKey(
    key: string,
    value: unknown,
    typeInt: number
): Promise<void> {
    await tauriClient.app.SetVRChatRegistryKey(key, value, typeInt);
}

export async function getVrchatUserModeration(
    currentUserId: string,
    userId: string
): Promise<unknown> {
    return tauriClient.app.GetVRChatUserModeration(currentUserId, userId);
}

export async function setVrchatUserModeration(
    currentUserId: string,
    userId: string,
    moderationType: string | number
): Promise<any> {
    return tauriClient.app.SetVRChatUserModeration(
        currentUserId,
        userId,
        moderationType
    );
}

export async function openDiscordProfile(discordId: string): Promise<void> {
    await tauriClient.discord.OpenDiscordProfile(discordId);
}

export async function deleteAllScreenshotMetadata(): Promise<void> {
    await tauriClient.app.DeleteAllScreenshotMetadata();
}

export async function isWindowMaximized(): Promise<boolean> {
    return Boolean(await tauriClient.webview.isWindowMaximized());
}

export async function minimizeWindow(): Promise<void> {
    await tauriClient.webview.minimizeWindow();
}

export async function toggleMaximizeWindow(): Promise<void> {
    await tauriClient.webview.toggleMaximizeWindow();
}

export async function closeWindow(): Promise<void> {
    await tauriClient.webview.closeWindow();
}
