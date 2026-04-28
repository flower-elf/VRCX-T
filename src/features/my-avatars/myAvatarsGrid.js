import {
    MY_AVATARS_DEFAULT_GRID_DENSITY,
    sanitizeMyAvatarsGridDensity
} from './myAvatarsState.js';

const MY_AVATARS_GRID_DENSITY_CONFIGS = Object.freeze({
    compact: Object.freeze({
        value: 'compact',
        gridGap: 8,
        gridMinWidth: 180,
        imageHeightRatio: 0.38,
        bodyPaddingX: 8,
        bodyPaddingY: 6,
        bodyGap: 2,
        nameFontSize: 13,
        nameLineHeight: 1.15,
        nameLines: 2,
        tagFontSize: 9,
        tagHeight: 16,
        maxVisibleTags: 2,
        rowPaddingY: 4
    }),
    dense: Object.freeze({
        value: 'dense',
        gridGap: 7,
        gridMinWidth: 150,
        imageHeightRatio: 0.34,
        bodyPaddingX: 7,
        bodyPaddingY: 5,
        bodyGap: 2,
        nameFontSize: 12,
        nameLineHeight: 1.12,
        nameLines: 2,
        tagFontSize: 8,
        tagHeight: 14,
        maxVisibleTags: 1,
        rowPaddingY: 3
    }),
    micro: Object.freeze({
        value: 'micro',
        gridGap: 6,
        gridMinWidth: 125,
        imageHeightRatio: 0.3,
        bodyPaddingX: 6,
        bodyPaddingY: 4,
        bodyGap: 1,
        nameFontSize: 11,
        nameLineHeight: 1.1,
        nameLines: 2,
        tagFontSize: 8,
        tagHeight: 12,
        maxVisibleTags: 0,
        rowPaddingY: 3
    })
});

export function getMyAvatarsGridDensityConfig(value) {
    return (
        MY_AVATARS_GRID_DENSITY_CONFIGS[sanitizeMyAvatarsGridDensity(value)] ||
        MY_AVATARS_GRID_DENSITY_CONFIGS[MY_AVATARS_DEFAULT_GRID_DENSITY]
    );
}

export function getMyAvatarsGridMetrics({
    cardScale,
    cardSpacing,
    gridDensity,
    width
}) {
    if (gridDensity) {
        const densityConfig = getMyAvatarsGridDensityConfig(gridDensity);
        const gridGap = densityConfig.gridGap;
        const gridMinWidth = densityConfig.gridMinWidth;
        const gridColumnCount = Math.max(
            1,
            Math.floor((width + gridGap) / (gridMinWidth + gridGap)) || 1
        );
        const gridColumnWidth =
            width > 0
                ? Math.max(
                      gridMinWidth,
                      (width - gridGap * Math.max(0, gridColumnCount - 1)) /
                          gridColumnCount
                  )
                : gridMinWidth;
        const cardNameHeight =
            densityConfig.nameFontSize *
            densityConfig.nameLineHeight *
            densityConfig.nameLines;
        const cardBodyHeight =
            densityConfig.bodyPaddingY * 2 +
            cardNameHeight +
            densityConfig.bodyGap +
            densityConfig.tagHeight;
        const gridRowHeight = Math.ceil(
            gridColumnWidth * densityConfig.imageHeightRatio +
                cardBodyHeight +
                densityConfig.rowPaddingY +
                gridGap
        );

        return {
            densityConfig,
            gridGap,
            gridMinWidth,
            gridColumnCount,
            gridColumnWidth,
            gridRowHeight
        };
    }

    const gridGap = Math.round(12 * cardSpacing);
    const gridMinWidth = Math.round(Math.max(200, 320 * cardScale));
    const gridColumnCount = Math.max(
        1,
        Math.floor((width + gridGap) / (gridMinWidth + gridGap)) || 1
    );
    const gridColumnWidth =
        width > 0
            ? Math.max(
                  gridMinWidth,
                  (width - gridGap * Math.max(0, gridColumnCount - 1)) /
                      gridColumnCount
              )
            : gridMinWidth;
    const cardNameFontSize = Math.max(12, Math.round(22 * cardScale));
    const cardNameHeight = cardNameFontSize * 2.75;
    const cardBodyPaddingY = Math.round(6 * cardScale) * 2;
    const cardTagsHeight = Math.max(14, Math.round(22 * cardScale));
    const cardBodyGap = 2;
    const cardBodyHeight =
        cardBodyPaddingY + cardNameHeight + cardBodyGap + cardTagsHeight;
    const rowPaddingY = 4;
    const gridRowHeight = Math.ceil(
        gridColumnWidth * 0.4 + cardBodyHeight + rowPaddingY + gridGap
    );

    return {
        gridGap,
        gridMinWidth,
        gridColumnCount,
        gridColumnWidth,
        gridRowHeight
    };
}

export function buildMyAvatarsGridRows({
    avatars,
    gridColumnCount,
    gridRowHeight
}) {
    const rows = [];
    const visibleAvatars = Array.isArray(avatars) ? avatars : [];
    for (
        let index = 0;
        index < visibleAvatars.length;
        index += gridColumnCount
    ) {
        rows.push({
            key: `grid-row:${index}`,
            avatars: visibleAvatars.slice(index, index + gridColumnCount),
            top: rows.length * gridRowHeight,
            height: gridRowHeight
        });
    }
    return rows;
}

export function getVisibleMyAvatarsGridRows({
    gridRows,
    scrollTop,
    viewportHeight
}) {
    const overscan = Math.max(480, viewportHeight);
    const start = Math.max(0, scrollTop - overscan);
    const end = scrollTop + viewportHeight + overscan;
    const visibleGridRows = Array.isArray(gridRows) ? gridRows : [];
    return visibleGridRows.filter(
        (row) => row.top + row.height >= start && row.top <= end
    );
}
