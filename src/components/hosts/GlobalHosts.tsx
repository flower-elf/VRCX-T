import { AppToaster } from './AppToaster';
import { BackgroundRouteResumeHost } from './BackgroundRouteResumeHost';
import { DialogHost } from './DialogHost';
import { FavoriteImportHost } from './FavoriteImportHost';
import { LaunchDialogHost } from './LaunchDialogHost';
import { ModalHost } from './ModalHost';
import { NotificationHost } from './NotificationHost';
import { SystemDialogsHost } from './SystemDialogsHost';
import { ToolsDialogsHost } from './ToolsDialogsHost';
import { VrcNotificationCenterHost } from './VrcNotificationCenterHost';

export function GlobalHosts() {
    return (
        <>
            <AppToaster />
            <BackgroundRouteResumeHost />
            <ModalHost />
            <DialogHost />
            <FavoriteImportHost />
            <NotificationHost />
            <VrcNotificationCenterHost />
            <LaunchDialogHost />
            <SystemDialogsHost />
            <ToolsDialogsHost />
        </>
    );
}
