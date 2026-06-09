import { PageBody, PageScaffold } from '@/components/layout/PageScaffold';

import { GalleryDialogs } from './components/GalleryDialogs';
import { GalleryHeader } from './components/GalleryHeader';
import { GalleryTabsSection } from './components/GalleryTabsSection';
import { useGalleryPageController } from './useGalleryPageController';

export function GalleryPage() {
    const pageState = useGalleryPageController();

    return (
        <PageScaffold className="gallery-page">
            <GalleryHeader
                uploadInputRef={pageState.uploadInputRef}
                uploadingTab={pageState.uploadingTab}
                onUploadChange={(event: any) => {
                    pageState.uploadSelectedFile(event);
                }}
                gridDensity={pageState.gridDensity}
                onGridDensityChange={pageState.changeGridDensity}
                onBack={() => pageState.navigate('/tools')}
                onRefreshAll={() => {
                    pageState.refreshAll();
                }}
            />

            <PageBody>
                <GalleryTabsSection
                    galleryModel={{
                        activeTab: pageState.activeTab,
                        assets: pageState.assets,
                        currentUserId: pageState.currentUserId,
                        gridDensityConfig: pageState.gridDensityConfig,
                        isVrcPlusSupporter: pageState.isVrcPlusSupporter,
                        loadingByTab: pageState.loadingByTab,
                        mutatingKey: pageState.mutatingKey,
                        profilePicOverride: pageState.profilePicOverride,
                        tabCounts: pageState.tabCounts,
                        uploadingTab: pageState.uploadingTab,
                        userIcon: pageState.userIcon
                    }}
                    galleryCommands={{
                        onActiveTabChange: pageState.setActiveTab,
                        onBeginUpload: pageState.beginUpload,
                        onClearProfileField: (fieldName: any, fileId: any) => {
                            pageState.setProfileField(fieldName, fileId);
                        },
                        onDeleteFile: (tab: any, fileId: any) => {
                            pageState.deleteFileAsset(tab, fileId);
                        },
                        onDeletePrint: (printId: any) => {
                            pageState.deletePrint(printId);
                        },
                        onPreview: pageState.openImagePreview,
                        onRefresh: (tab: any) => {
                            pageState.refreshTab(tab);
                        },
                        onSetProfileField: (fieldName: any, fileId: any) => {
                            pageState.setProfileField(fieldName, fileId);
                        }
                    }}
                />
            </PageBody>

            <GalleryDialogs
                cropRequest={pageState.cropRequest}
                onClearCropRequest={() => pageState.setCropRequest(null)}
                onConfirmCrop={(blob: any, uploadOptions: any) =>
                    pageState.confirmCroppedUpload(blob, uploadOptions)
                }
                onResetUploadAuthTarget={() => {
                    pageState.uploadAuthTargetRef.current = null;
                }}
            />
        </PageScaffold>
    );
}
