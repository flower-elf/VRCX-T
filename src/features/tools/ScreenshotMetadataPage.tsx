import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageScaffold } from '@/components/layout/PageScaffold';
import { convertFileSrc } from '@/platform/tauri/assets';
import configRepository from '@/repositories/configRepository';
import mediaRepository from '@/repositories/mediaRepository';
import { withUploadTimeout } from '@/shared/utils/imageUpload';
import { useModalStore } from '@/state/modalStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import { ScreenshotGalleryView } from './components/ScreenshotGalleryView';
import {
    ScreenshotMetadataDetailsCard,
    ScreenshotMetadataHeader,
    ScreenshotMetadataPreviewCard,
    ScreenshotMetadataResultsTable,
    ScreenshotMetadataToolbar
} from './components/ScreenshotMetadataSections';
import {
    buildScreenshotSearchRow,
    DEFAULT_SCREENSHOT_SEARCH_SORT,
    getDroppedScreenshotPath,
    normalizeScreenshotMetadata,
    SCREENSHOT_METADATA_SEARCH_TYPES,
    sortScreenshotRowsByNewest,
    sortScreenshotSearchRows
} from './screenshotMetadataValues';
import { useScreenshotMetadataNavigation } from './useScreenshotMetadataNavigation';

function openSearchResult(
    row: any,
    { openDetailPath, setSelectedPath, setSearchViewMode }: any
) {
    setSelectedPath(row.filePath);
    setSearchViewMode('detail');
    openDetailPath(row.filePath);
}

function getFolderLatestModifiedAt(folder: any) {
    return Number(folder?.latestModifiedAt) || 0;
}

const SCREENSHOT_GALLERY_FOLDER_CONFIG_KEY = 'screenshotGalleryFolder';
const SCREENSHOT_GALLERY_SCROLL_CONFIG_KEY = 'screenshotGalleryScrollPositions';
const SCREENSHOT_GALLERY_SCROLL_SAVE_DELAY_MS = 500;
const MAX_SCREENSHOT_GALLERY_SCROLL_POSITIONS = 100;
const MAX_SCREENSHOT_GALLERY_SCROLL_TOP = 50_000_000;

function normalizeGalleryScrollTop(value: any) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.min(
        MAX_SCREENSHOT_GALLERY_SCROLL_TOP,
        Math.max(0, Math.round(numeric))
    );
}

function normalizeGalleryScrollPositions(value: any) {
    const entries =
        value && typeof value === 'object' && !Array.isArray(value)
            ? Object.entries(value)
            : [];
    const positions = new Map();

    for (const [path, scrollTop] of entries) {
        if (!path || typeof path !== 'string') {
            continue;
        }
        positions.set(path, normalizeGalleryScrollTop(scrollTop));
        if (positions.size >= MAX_SCREENSHOT_GALLERY_SCROLL_POSITIONS) {
            break;
        }
    }

    return positions;
}

function serializeGalleryScrollPositions(positions: any) {
    const result: Record<string, number> = {};
    for (const [path, scrollTop] of Array.from(positions.entries())
        .filter(([path]: any) => Boolean(path))
        .slice(-MAX_SCREENSHOT_GALLERY_SCROLL_POSITIONS) as any[]) {
        result[String(path)] = normalizeGalleryScrollTop(scrollTop);
    }
    return result;
}

function getGalleryFolderPathSet(folderTree: any) {
    return new Set(
        (Array.isArray(folderTree?.folders) ? folderTree.folders : [])
            .map((folder: any) => folder?.path)
            .filter(Boolean)
    );
}

function resolveGalleryFolder(folderTree: any, preferredFolders: any) {
    const folders = Array.isArray(folderTree?.folders)
        ? folderTree.folders
        : [];
    const preferredList = Array.isArray(preferredFolders)
        ? preferredFolders
        : [preferredFolders];
    for (const preferredFolder of preferredList) {
        if (
            preferredFolder &&
            folders.some((folder: any) => folder.path === preferredFolder)
        ) {
            return preferredFolder;
        }
    }
    const latestFolder = folders
        .filter((folder: any) => Number(folder.imageCount) > 0)
        .sort(
            (left: any, right: any) =>
                getFolderLatestModifiedAt(right) -
                    getFolderLatestModifiedAt(left) ||
                String(right.path || '').localeCompare(String(left.path || ''))
        )[0];
    return latestFolder?.path || folderTree?.rootPath || folders[0]?.path || '';
}

export function ScreenshotMetadataPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { i18n, t } = useTranslation();
    const confirm = useModalStore((state: any) => state.confirm);
    const openImagePreview = useModalStore(
        (state: any) => state.openImagePreview
    );
    const currentEndpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const screenshotCacheStatus = useRuntimeStore(
        (state: any) => state.hostCapabilities.screenshotCache
    );
    const currentUserSnapshot = useRuntimeStore(
        (state: any) => state.auth.currentUserSnapshot
    );
    const isVrcPlusSupporter = Boolean(
        currentUserSnapshot?.$isVRCPlus ||
        currentUserSnapshot?.tags?.includes?.('system_supporter') ||
        globalThis?.$debug?.debugVrcPlus
    );
    const imageVersionRef = useRef(0);
    const metadataRequestRef = useRef(0);
    const searchRequestRef = useRef(0);
    const galleryRequestRef = useRef(0);
    const selectedGalleryFolderRef = useRef('');
    const galleryScrollPositionsRef = useRef(new Map());
    const galleryScrollPersistTimerRef = useRef<number | null>(null);
    const routePath = searchParams.get('path') || '';
    const routeFolder = searchParams.get('folder') || '';
    const isGalleryMode = !routePath;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState(
        SCREENSHOT_METADATA_SEARCH_TYPES[0].value
    );
    const [searchRows, setSearchRows] = useState<any[]>([]);
    const [searchViewMode, setSearchViewMode] = useState('detail');
    const [searchSort, setSearchSort] = useState(
        DEFAULT_SCREENSHOT_SEARCH_SORT
    );
    const [selectedPath, setSelectedPath] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [metadataError, setMetadataError] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isMetadataLoading, setIsMetadataLoading] = useState(false);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isDeletingMetadata, setIsDeletingMetadata] = useState(false);
    const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
    const [folderTree, setFolderTree] = useState(null);
    const [galleryImages, setGalleryImages] = useState<any[]>([]);
    const [galleryImagesFolder, setGalleryImagesFolder] = useState('');
    const [selectedGalleryFolder, setSelectedGalleryFolder] = useState('');
    const [storedGalleryFolder, setStoredGalleryFolder] = useState('');
    const [isGalleryFolderPreferenceLoaded, setIsGalleryFolderPreferenceLoaded] =
        useState(false);
    const [scanStatus, setScanStatus] = useState(null);
    const [galleryScanError, setGalleryScanError] = useState('');
    const [galleryTreeError, setGalleryTreeError] = useState('');
    const [galleryImagesError, setGalleryImagesError] = useState('');
    const [isGalleryTreeLoading, setIsGalleryTreeLoading] = useState(false);
    const [isGalleryImagesLoading, setIsGalleryImagesLoading] = useState(false);
    const [galleryRevision, setGalleryRevision] = useState(0);

    const currentSearchType =
        SCREENSHOT_METADATA_SEARCH_TYPES.find(
            (type: any) => type.value === searchType
        ) ?? SCREENSHOT_METADATA_SEARCH_TYPES[0];

    const sortedSearchRows = useMemo(
        () => sortScreenshotSearchRows(searchRows, searchSort),
        [searchRows, searchSort]
    );

    const searchNavigationPaths = useMemo(
        () => sortedSearchRows.map((row: any) => row.filePath),
        [sortedSearchRows]
    );
    const selectedPathIndex = searchNavigationPaths.indexOf(selectedPath);
    const dateLocale = i18n.resolvedLanguage || i18n.language;
    const visibleGalleryImages =
        galleryImagesFolder === selectedGalleryFolder ? galleryImages : [];
    const selectedGalleryScrollTop =
        galleryScrollPositionsRef.current.get(selectedGalleryFolder) || 0;
    const shouldShowGalleryImagesLoading =
        isGalleryImagesLoading && visibleGalleryImages.length === 0;

    const updateRoutePath = useCallback(
        (path: any) => {
            const nextParams = new URLSearchParams();
            nextParams.set('path', path);
            const folder = selectedGalleryFolder || routeFolder;
            if (folder) {
                nextParams.set('folder', folder);
            }
            setSearchParams(nextParams);
        },
        [routeFolder, selectedGalleryFolder, setSearchParams]
    );

    useEffect(() => {
        let active = true;
        Promise.all([
            configRepository.getString(SCREENSHOT_GALLERY_FOLDER_CONFIG_KEY, ''),
            configRepository.getObject(SCREENSHOT_GALLERY_SCROLL_CONFIG_KEY, {})
        ])
            .then(([folder, scrollPositions]: any) => {
                if (!active) {
                    return;
                }
                setStoredGalleryFolder(folder || '');
                galleryScrollPositionsRef.current =
                    normalizeGalleryScrollPositions(scrollPositions);
            })
            .catch(() => {})
            .finally(() => {
                if (active) {
                    setIsGalleryFolderPreferenceLoaded(true);
                }
            });

        return () => {
            active = false;
            if (galleryScrollPersistTimerRef.current !== null) {
                window.clearTimeout(galleryScrollPersistTimerRef.current);
                galleryScrollPersistTimerRef.current = null;
                configRepository
                    .setObject(
                        SCREENSHOT_GALLERY_SCROLL_CONFIG_KEY,
                        serializeGalleryScrollPositions(
                            galleryScrollPositionsRef.current
                        )
                    )
                    .catch(() => {});
            }
        };
    }, []);

    useEffect(() => {
        selectedGalleryFolderRef.current = selectedGalleryFolder;
    }, [selectedGalleryFolder]);

    useEffect(() => {
        if (
            !isGalleryMode ||
            !isGalleryFolderPreferenceLoaded ||
            !selectedGalleryFolder ||
            selectedGalleryFolder === storedGalleryFolder
        ) {
            return;
        }

        setStoredGalleryFolder(selectedGalleryFolder);
        configRepository
            .setString(
                SCREENSHOT_GALLERY_FOLDER_CONFIG_KEY,
                selectedGalleryFolder
            )
            .catch(() => {});
    }, [
        isGalleryFolderPreferenceLoaded,
        isGalleryMode,
        selectedGalleryFolder,
        storedGalleryFolder
    ]);

    const openDetailPath = useCallback(
        (path: any, { clearPreview = true }: any = {}) => {
            if (path) {
                if (clearPreview) {
                    metadataRequestRef.current += 1;
                    setMetadata(null);
                    setMetadataError('');
                    setImageUrl('');
                }
                updateRoutePath(path);
            }
        },
        [updateRoutePath]
    );

    const openGalleryRoute = useCallback(
        (folder: any = selectedGalleryFolder || routeFolder) => {
            const nextParams = new URLSearchParams();
            if (folder) {
                nextParams.set('folder', folder);
            }
            setSearchParams(nextParams);
        },
        [routeFolder, selectedGalleryFolder, setSearchParams]
    );

    function resetSearchContext({
        clearQuery = false,
        clearPreview = false
    }: any = {}) {
        setSearchRows([]);
        setSelectedPath('');

        if (clearQuery) {
            setSearchQuery('');
        }

        if (clearPreview) {
            setMetadata(null);
            setMetadataError('');
            setImageUrl('');
        }

        setSearchViewMode('detail');
    }

    async function loadScreenshot(path: any, withCarousel: any = true) {
        if (!path) {
            return;
        }

        const requestId = metadataRequestRef.current + 1;
        metadataRequestRef.current = requestId;
        setIsMetadataLoading(true);
        setMetadataError('');

        try {
            const rawMetadata: any =
                await mediaRepository.getScreenshotMetadata(path);

            if (metadataRequestRef.current !== requestId) {
                return;
            }

            if (!rawMetadata?.sourceFile) {
                const message = t('dialog.screenshot_metadata.invalid_file');
                setMetadata(null);
                setImageUrl('');
                setMetadataError(message);
                toast.error(message);
                return;
            }

            const extra = await mediaRepository.getExtraScreenshotData(
                rawMetadata.sourceFile,
                withCarousel
            );

            if (metadataRequestRef.current !== requestId) {
                return;
            }

            const nextMetadata = normalizeScreenshotMetadata(
                rawMetadata,
                extra
            );
            const nextMetadataError = rawMetadata?.error
                ? String(rawMetadata.error)
                : '';
            imageVersionRef.current += 1;

            setMetadata(nextMetadata);
            setMetadataError(nextMetadataError);
            setSelectedPath(nextMetadata.filePath);
            setImageUrl(
                `${convertFileSrc(nextMetadata.filePath, 'vrcx-0-img')}?v=${imageVersionRef.current}`
            );
        } catch (error) {
            if (metadataRequestRef.current !== requestId) {
                return;
            }

            setMetadata(null);
            setImageUrl('');
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load screenshot metadata.';
            setMetadataError(message);
            toast.error(message);
        } finally {
            if (metadataRequestRef.current === requestId) {
                setIsMetadataLoading(false);
            }
        }
    }

    async function loadLastScreenshot() {
        try {
            resetSearchContext({ clearQuery: true });
            const path = await mediaRepository.getLastScreenshot();
            if (!path) {
                const message = t('dialog.screenshot_metadata.invalid_file');
                setMetadata(null);
                setImageUrl('');
                setMetadataError(message);
                toast.error(message);
                return;
            }
            openDetailPath(path);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load last screenshot.';
            setMetadata(null);
            setImageUrl('');
            setMetadataError(message);
            toast.error(message);
        }
    }

    useEffect(() => {
        if (!routePath) {
            return;
        }
        setSearchViewMode('detail');
        loadScreenshot(routePath, true);
    }, [routePath]);

    const { navigateNext, navigatePrev } = useScreenshotMetadataNavigation({
        loadScreenshot,
        metadata,
        onPathChange: updateRoutePath,
        searchNavigationPaths,
        selectedPath,
        setSelectedPath
    });

    async function loadGalleryTree({ preferPopulated = false }: any = {}) {
        setIsGalleryTreeLoading(true);
        try {
            const tree = await mediaRepository.getScreenshotFolderTree();
            setFolderTree(tree || null);
            setGalleryTreeError('');
            const folderPathSet = getGalleryFolderPathSet(tree);
            galleryScrollPositionsRef.current = new Map(
                Array.from(galleryScrollPositionsRef.current.entries()).filter(
                    ([path]: any) => folderPathSet.has(path)
                )
            );
            setSelectedGalleryFolder((current: any) =>
                resolveGalleryFolder(
                    tree,
                    preferPopulated
                        ? [
                              routeFolder,
                              selectedGalleryFolderRef.current,
                              storedGalleryFolder
                          ]
                        : [
                              routeFolder,
                              routeFolder ? '' : current,
                              storedGalleryFolder
                          ]
                )
            );
            setGalleryRevision((current: any) => current + 1);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t('dialog.screenshot_metadata.gallery_load_failed');
            setGalleryTreeError(message);
            toast.error(message);
        } finally {
            setIsGalleryTreeLoading(false);
        }
    }

    async function refreshGallery(force: any = false) {
        setGalleryScanError('');
        setGalleryTreeError('');
        setGalleryImagesError('');
        try {
            const status =
                await mediaRepository.startScreenshotLibraryScan(force);
            setScanStatus(status || null);
            setGalleryScanError(status?.error || '');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t('dialog.screenshot_metadata.scan_failed');
            setGalleryScanError(message);
            toast.error(message);
        }
        await loadGalleryTree({ preferPopulated: force });
    }

    useEffect(() => {
        if (
            !isGalleryMode ||
            !screenshotCacheStatus?.available ||
            !isGalleryFolderPreferenceLoaded
        ) {
            return;
        }
        refreshGallery(false);
    }, [
        isGalleryFolderPreferenceLoaded,
        isGalleryMode,
        screenshotCacheStatus?.available
    ]);

    useEffect(() => {
        if (!isGalleryMode || !folderTree) {
            return;
        }
        setSelectedGalleryFolder(
            resolveGalleryFolder(folderTree, [
                routeFolder,
                routeFolder ? '' : selectedGalleryFolder,
                storedGalleryFolder
            ])
        );
    }, [
        folderTree,
        isGalleryMode,
        routeFolder,
        selectedGalleryFolder,
        storedGalleryFolder
    ]);

    useEffect(() => {
        if (!isGalleryMode || !scanStatus?.running) {
            return undefined;
        }

        let active = true;
        let pollInFlight = false;
        let scanCompleted = false;
        const timer = window.setInterval(() => {
            if (pollInFlight || scanCompleted) {
                return;
            }
            pollInFlight = true;
            mediaRepository
                .getScreenshotLibraryStatus()
                .then((status: any) => {
                    if (!active) {
                        return;
                    }
                    setScanStatus(status || null);
                    setGalleryScanError(status?.error || '');
                    if (!status?.running) {
                        scanCompleted = true;
                        window.clearInterval(timer);
                        loadGalleryTree({ preferPopulated: true });
                    }
                })
                .catch((error: any) => {
                    if (!active) {
                        return;
                    }
                    const message =
                        error instanceof Error
                            ? error.message
                            : t('dialog.screenshot_metadata.scan_failed');
                    setGalleryScanError(message);
                    setScanStatus((current: any) =>
                        current ? { ...current, running: false } : current
                    );
                })
                .finally(() => {
                    pollInFlight = false;
                });
        }, 1000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [isGalleryMode, scanStatus?.running, t]);

    useEffect(() => {
        if (!isGalleryMode || !selectedGalleryFolder) {
            galleryRequestRef.current += 1;
            setGalleryImages([]);
            setGalleryImagesFolder('');
            setIsGalleryImagesLoading(false);
            return;
        }

        const requestId = galleryRequestRef.current + 1;
        galleryRequestRef.current = requestId;
        const requestedFolder = selectedGalleryFolder;
        setIsGalleryImagesLoading(true);

        mediaRepository
            .getScreenshotFolderImages(requestedFolder)
            .then((images: any) => {
                if (galleryRequestRef.current === requestId) {
                    setGalleryImagesError('');
                    setGalleryImages(Array.isArray(images) ? images : []);
                    setGalleryImagesFolder(requestedFolder);
                }
            })
            .catch((error: any) => {
                if (galleryRequestRef.current === requestId) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : t(
                                  'dialog.screenshot_metadata.gallery_load_failed'
                              );
                    setGalleryImagesError(message);
                    setGalleryImages([]);
                    setGalleryImagesFolder(requestedFolder);
                    toast.error(message);
                }
            })
            .finally(() => {
                if (galleryRequestRef.current === requestId) {
                    setIsGalleryImagesLoading(false);
                }
            });
    }, [galleryRevision, isGalleryMode, selectedGalleryFolder, t]);

    function selectGalleryFolder(folder: any) {
        setSelectedGalleryFolder(folder);
        const nextParams = new URLSearchParams();
        if (folder) {
            nextParams.set('folder', folder);
        }
        setSearchParams(nextParams);
    }

    const updateGalleryScrollPosition = useCallback(
        (folder: any, scrollTop: any) => {
            if (!folder) {
                return;
            }
            const normalizedScrollTop = normalizeGalleryScrollTop(scrollTop);
            const positions = galleryScrollPositionsRef.current;
            positions.delete(folder);
            positions.set(folder, normalizedScrollTop);

            if (galleryScrollPersistTimerRef.current !== null) {
                window.clearTimeout(galleryScrollPersistTimerRef.current);
            }
            galleryScrollPersistTimerRef.current = window.setTimeout(() => {
                galleryScrollPersistTimerRef.current = null;
                configRepository
                    .setObject(
                        SCREENSHOT_GALLERY_SCROLL_CONFIG_KEY,
                        serializeGalleryScrollPositions(
                            galleryScrollPositionsRef.current
                        )
                    )
                    .catch(() => {});
            }, SCREENSHOT_GALLERY_SCROLL_SAVE_DELAY_MS);
        },
        []
    );

    useEffect(() => {
        if (!isGalleryFolderPreferenceLoaded || !folderTree) {
            return;
        }
        configRepository
            .setObject(
                SCREENSHOT_GALLERY_SCROLL_CONFIG_KEY,
                serializeGalleryScrollPositions(
                    galleryScrollPositionsRef.current
                )
            )
            .catch(() => {});
    }, [folderTree, isGalleryFolderPreferenceLoaded]);

    async function browseForScreenshot() {
        try {
            const defaultPath =
                selectedGalleryFolder ||
                storedGalleryFolder ||
                (await mediaRepository.getVrchatPhotosLocation());
            const filePath = await mediaRepository.openFileSelectorDialog(
                defaultPath || '',
                '.png',
                'PNG Files (*.png)|*.png'
            );

            if (!filePath) {
                return;
            }

            resetSearchContext({ clearQuery: true });
            openDetailPath(filePath);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.tools.toast.failed_to_open_screenshot_picker')
            );
        }
    }

    async function openFolder() {
        if (!metadata?.filePath) {
            return;
        }

        try {
            await mediaRepository.openFolderAndSelectItem(
                metadata.filePath,
                false
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.tools.toast.failed_to_open_folder')
            );
        }
    }

    async function copyImage() {
        if (!metadata?.filePath) {
            return;
        }

        try {
            await mediaRepository.copyImageToClipboard(metadata.filePath);
            toast.success(t('message.image.copied_to_clipboard'));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.tools.toast.failed_to_copy_image')
            );
        }
    }

    async function deleteMetadata() {
        const filePath = metadata?.filePath || '';
        if (!filePath) {
            return;
        }

        const result = await confirm({
            title: t('dialog.screenshot_metadata.delete_metadata'),
            description: metadata?.fileName || filePath,
            confirmText: t('dialog.screenshot_metadata.delete_metadata'),
            cancelText: t('common.actions.cancel'),
            destructive: true
        });
        if (!result.ok) {
            return;
        }

        setIsDeletingMetadata(true);

        try {
            const deleted =
                await mediaRepository.deleteScreenshotMetadata(filePath);
            if (!deleted) {
                toast.error(t('message.screenshot_metadata.delete_failed'));
                return;
            }

            toast.success(t('message.screenshot_metadata.deleted'));
            await loadScreenshot(filePath, true);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('message.screenshot_metadata.delete_failed')
            );
        } finally {
            setIsDeletingMetadata(false);
        }
    }

    async function uploadScreenshotToGallery() {
        if (!metadata?.filePath) {
            return;
        }
        if (!isVrcPlusSupporter) {
            toast.error(t('message.vrcplus.required'));
            return;
        }
        if (Number(metadata.fileSizeBytes) > 10_000_000) {
            toast.error(t('message.file.too_large'));
            return;
        }

        setIsUploadingScreenshot(true);
        try {
            const base64Body = await mediaRepository.getFileBase64(
                metadata.filePath
            );
            await withUploadTimeout(
                mediaRepository.uploadGalleryImage(base64Body, {
                    endpoint: currentEndpoint
                })
            );
            toast.success(t('message.gallery.uploaded'));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('message.gallery.failed')
            );
        } finally {
            setIsUploadingScreenshot(false);
        }
    }

    async function runSearch(
        nextSearchType: any = searchType,
        nextSearchQuery: any = searchQuery
    ) {
        const query = nextSearchQuery.trim();
        const selectedSearchType =
            SCREENSHOT_METADATA_SEARCH_TYPES.find(
                (type: any) => type.value === nextSearchType
            ) ?? SCREENSHOT_METADATA_SEARCH_TYPES[0];

        if (!query) {
            searchRequestRef.current += 1;
            resetSearchContext();
            if (metadata?.filePath) {
                await loadScreenshot(metadata.filePath, true);
            }
            return;
        }

        const requestId = searchRequestRef.current + 1;
        searchRequestRef.current = requestId;
        setIsSearchLoading(true);

        try {
            const paths = await mediaRepository.findScreenshotsBySearch(
                query,
                selectedSearchType.index
            );

            if (searchRequestRef.current !== requestId) {
                return;
            }

            if (!Array.isArray(paths) || paths.length === 0) {
                const message = t('dialog.screenshot_metadata.no_results');
                resetSearchContext({ clearPreview: true });
                setMetadataError(message);
                toast.error(message);
                return;
            }

            const rows = await Promise.all(
                paths.map(async (path: any) => {
                    try {
                        const [rawMetadata, extra] = await Promise.all([
                            mediaRepository.getScreenshotMetadata(path),
                            mediaRepository.getExtraScreenshotData(path, false)
                        ]);
                        const normalized = normalizeScreenshotMetadata(
                            rawMetadata ?? {},
                            extra ?? {}
                        );
                        return buildScreenshotSearchRow(
                            normalized,
                            selectedSearchType,
                            query,
                            dateLocale
                        );
                    } catch (error) {
                        console.error(
                            'Failed to enrich screenshot search result:',
                            path,
                            error
                        );
                        return null;
                    }
                })
            );

            if (searchRequestRef.current !== requestId) {
                return;
            }

            const nextRows = sortScreenshotRowsByNewest(rows);

            setSearchRows(nextRows);
            setMetadataError('');
            setSelectedPath('');
            setSearchViewMode('table');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to search screenshot metadata.';
            setMetadata(null);
            setImageUrl('');
            setMetadataError(message);
            toast.error(message);
        } finally {
            if (searchRequestRef.current === requestId) {
                setIsSearchLoading(false);
            }
        }
    }

    function handleSearchTypeChange(value: any) {
        setSearchType(value);
        if (searchQuery.trim()) {
            setSearchRows([]);
            setSelectedPath('');
        }
        runSearch(value);
    }

    function toggleSearchSort(key: any) {
        setSearchSort((current: any) => {
            if (current.key === key) {
                return {
                    ...current,
                    asc: !current.asc
                };
            }

            return {
                key,
                asc: key !== 'dateTime'
            };
        });
    }

    async function handleScreenshotDrop(event: any) {
        event.preventDefault();
        const filePath = getDroppedScreenshotPath(event);
        if (!filePath) {
            toast.error(
                t('view.tools.error.dropped_screenshot_path_is_not_available')
            );
            return;
        }
        resetSearchContext({ clearQuery: true });
        openDetailPath(filePath);
    }

    function handleScreenshotDragOver(event: any) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    }

    if (!screenshotCacheStatus?.available) {
        return (
            <PageScaffold className="screenshot-metadata-page flex-1">
                <ScreenshotMetadataHeader
                    backLabel={t('nav_tooltip.tools')}
                    title={t('dialog.screenshot_metadata.header')}
                    deleting={false}
                    uploading={false}
                    deletingLabel={t('view.tools.loading.deleting_metadata')}
                    uploadingLabel={t(
                        'view.tools.loading.uploading_screenshot'
                    )}
                    onBack={() => navigate('/tools')}
                />
                <div className="text-muted-foreground mt-4 rounded-md border p-4 text-sm">
                    {screenshotCacheStatus?.reason ||
                        'Screenshot cache is unavailable on this platform.'}
                </div>
            </PageScaffold>
        );
    }

    return (
        <PageScaffold className="screenshot-metadata-page flex-1">
            <ScreenshotMetadataHeader
                backLabel={t('nav_tooltip.tools')}
                title={t('dialog.screenshot_metadata.header')}
                deleting={isDeletingMetadata}
                uploading={isUploadingScreenshot}
                deletingLabel={t('view.tools.loading.deleting_metadata')}
                uploadingLabel={t('view.tools.loading.uploading_screenshot')}
                onBack={() =>
                    isGalleryMode ? navigate('/tools') : openGalleryRoute()
                }
            />

            {isGalleryMode ? (
                <ScreenshotGalleryView
                    folderTree={folderTree}
                    images={visibleGalleryImages}
                    isImagesLoading={shouldShowGalleryImagesLoading}
                    isTreeLoading={isGalleryTreeLoading && !folderTree}
                    error={
                        galleryScanError ||
                        galleryTreeError ||
                        galleryImagesError
                    }
                    scanStatus={scanStatus}
                    selectedFolder={selectedGalleryFolder}
                    onOpenImage={openDetailPath}
                    onRefresh={() => {
                        refreshGallery(true);
                    }}
                    onSelectFolder={selectGalleryFolder}
                    onScrollPositionChange={updateGalleryScrollPosition}
                    restoreScrollTop={selectedGalleryScrollTop}
                />
            ) : (
                <>
                    <ScreenshotMetadataToolbar
                        metadata={metadata}
                        isVrcPlusSupporter={isVrcPlusSupporter}
                        isUploadingScreenshot={isUploadingScreenshot}
                        isDeletingMetadata={isDeletingMetadata}
                        searchQuery={searchQuery}
                        searchType={searchType}
                        searchViewMode={searchViewMode}
                        searchRowsCount={searchRows.length}
                        searchNavigationCount={searchNavigationPaths.length}
                        selectedPathIndex={selectedPathIndex}
                        onSearchQueryChange={setSearchQuery}
                        onSearchTypeChange={handleSearchTypeChange}
                        onSearch={() => {
                            runSearch();
                        }}
                        onBrowse={() => {
                            browseForScreenshot();
                        }}
                        onLoadLast={() => {
                            loadLastScreenshot();
                        }}
                        onOpenFolder={() => {
                            openFolder();
                        }}
                        onCopyImage={() => {
                            copyImage();
                        }}
                        onUpload={() => {
                            uploadScreenshotToGallery();
                        }}
                        onDelete={() => {
                            deleteMetadata();
                        }}
                    />

                    {searchViewMode === 'table' ? (
                        <ScreenshotMetadataResultsTable
                            isSearchLoading={isSearchLoading}
                            currentSearchType={currentSearchType}
                            searchSort={searchSort}
                            sortedSearchRows={sortedSearchRows}
                            selectedPath={selectedPath}
                            onToggleSearchSort={toggleSearchSort}
                            onOpenResult={(row: any) =>
                                openSearchResult(row, {
                                    openDetailPath,
                                    setSelectedPath,
                                    setSearchViewMode
                                })
                            }
                        />
                    ) : (
                        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                            <ScreenshotMetadataPreviewCard
                                metadata={metadata}
                                imageUrl={imageUrl}
                                isMetadataLoading={isMetadataLoading}
                                onNavigatePrev={() => {
                                    navigatePrev();
                                }}
                                onNavigateNext={() => {
                                    navigateNext();
                                }}
                                onImagePreview={() =>
                                    openImagePreview({
                                        url: imageUrl,
                                        title:
                                            metadata?.fileName ||
                                            'Screenshot preview',
                                        fileName: metadata?.fileName || '',
                                        sourcePath: metadata?.filePath || ''
                                    })
                                }
                                onDragOver={handleScreenshotDragOver}
                                onDrop={(event: any) => {
                                    handleScreenshotDrop(event);
                                }}
                            />

                            <ScreenshotMetadataDetailsCard
                                metadata={metadata}
                                metadataError={metadataError}
                                searchRowsCount={searchRows.length}
                                currentEndpoint={currentEndpoint}
                                onBackToResults={() =>
                                    setSearchViewMode('table')
                                }
                            />
                        </div>
                    )}
                </>
            )}
        </PageScaffold>
    );
}
