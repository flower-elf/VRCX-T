import { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildMyAvatarsGridRows,
    getMyAvatarsGridMetrics,
    getVisibleMyAvatarsGridRows
} from './myAvatarsGrid.js';

const MY_AVATARS_GRID_HORIZONTAL_INSET = 12;

export function useMyAvatarsGridVirtualization({
    deferredSearchQuery,
    filteredAvatars,
    gridDensity,
    platformFilter,
    releaseStatusFilter,
    tagFilters,
    viewMode
}) {
    const gridScrollRef = useRef(null);
    const [gridScrollMetrics, setGridScrollMetrics] = useState({
        scrollTop: 0,
        viewportHeight: 0,
        width: 0
    });

    useEffect(() => {
        if (viewMode !== 'grid') {
            return undefined;
        }

        function updateGridScrollMetrics() {
            const node = gridScrollRef.current;
            if (!node) {
                return;
            }

            const nextMetrics = {
                scrollTop: node.scrollTop,
                viewportHeight: node.clientHeight,
                width: node.clientWidth
            };

            setGridScrollMetrics((current) =>
                current.scrollTop === nextMetrics.scrollTop &&
                current.viewportHeight === nextMetrics.viewportHeight &&
                current.width === nextMetrics.width
                    ? current
                    : nextMetrics
            );
        }

        const node = gridScrollRef.current;
        if (!node) {
            return undefined;
        }

        updateGridScrollMetrics();
        node.addEventListener('scroll', updateGridScrollMetrics, {
            passive: true
        });

        const observer =
            typeof ResizeObserver === 'function'
                ? new ResizeObserver(updateGridScrollMetrics)
                : null;
        observer?.observe(node);
        window.addEventListener('resize', updateGridScrollMetrics);

        return () => {
            node.removeEventListener('scroll', updateGridScrollMetrics);
            observer?.disconnect();
            window.removeEventListener('resize', updateGridScrollMetrics);
        };
    }, [filteredAvatars.length, viewMode]);

    useEffect(() => {
        if (viewMode !== 'grid') {
            return;
        }

        const node = gridScrollRef.current;
        if (node) {
            node.scrollTop = 0;
        }

        setGridScrollMetrics((current) => ({
            ...current,
            scrollTop: 0
        }));
    }, [
        deferredSearchQuery,
        filteredAvatars.length,
        gridDensity,
        platformFilter,
        releaseStatusFilter,
        tagFilters,
        viewMode
    ]);

    const {
        densityConfig,
        gridGap,
        gridMinWidth,
        gridColumnCount,
        gridRowHeight
    } =
        getMyAvatarsGridMetrics({
            gridDensity,
            width: Math.max(
                0,
                gridScrollMetrics.width - MY_AVATARS_GRID_HORIZONTAL_INSET
            )
        });
    const gridRows = useMemo(
        () =>
            buildMyAvatarsGridRows({
                avatars: filteredAvatars,
                gridColumnCount,
                gridRowHeight
            }),
        [filteredAvatars, gridColumnCount, gridRowHeight]
    );
    const visibleGridRows = useMemo(
        () =>
            getVisibleMyAvatarsGridRows({
                gridRows,
                scrollTop: gridScrollMetrics.scrollTop,
                viewportHeight: gridScrollMetrics.viewportHeight
            }),
        [
            gridRows,
            gridScrollMetrics.scrollTop,
            gridScrollMetrics.viewportHeight
        ]
    );

    return {
        densityConfig,
        gridGap,
        gridColumnCount,
        gridMinWidth,
        gridScrollRef,
        gridTotalHeight: gridRows.length * gridRowHeight,
        visibleGridRows
    };
}
