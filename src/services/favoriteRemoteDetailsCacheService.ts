type FavoriteRemoteDetailsCacheStats = {
    detailCacheCount: number;
    detailPromiseCount: number;
};

const detailCache = new Map<unknown, unknown>();
const detailPromises = new Map<unknown, unknown>();

let detailCacheGeneration = 0;

export function clearFavoriteRemoteDetailsCache(): FavoriteRemoteDetailsCacheStats {
    const result = {
        detailCacheCount: detailCache.size,
        detailPromiseCount: detailPromises.size
    };
    detailCacheGeneration += 1;
    detailCache.clear();
    detailPromises.clear();
    return result;
}

export function getFavoriteRemoteDetailsCacheStats(): FavoriteRemoteDetailsCacheStats {
    return {
        detailCacheCount: detailCache.size,
        detailPromiseCount: detailPromises.size
    };
}

export function getFavoriteRemoteDetailsCacheGeneration(): number {
    return detailCacheGeneration;
}

export function getFavoriteRemoteDetailsCache(cacheKey: unknown): unknown {
    return detailCache.get(cacheKey);
}

export function setFavoriteRemoteDetailsCache(
    cacheKey: unknown,
    state: unknown
): void {
    detailCache.set(cacheKey, state);
}

export function getFavoriteRemoteDetailsPromise(cacheKey: unknown): unknown {
    return detailPromises.get(cacheKey);
}

export function setFavoriteRemoteDetailsPromise(
    cacheKey: unknown,
    promise: unknown
): void {
    detailPromises.set(cacheKey, promise);
}

export function deleteFavoriteRemoteDetailsPromise(cacheKey: unknown): void {
    detailPromises.delete(cacheKey);
}
