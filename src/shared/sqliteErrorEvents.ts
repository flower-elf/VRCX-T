type SQLiteErrorListener = (error: unknown) => void;

const sqliteErrorListeners = new Set<SQLiteErrorListener>();

export function subscribeSQLiteError(listener: unknown): () => void {
    if (typeof listener !== 'function') {
        return () => {};
    }
    const sqliteErrorListener = listener as SQLiteErrorListener;
    sqliteErrorListeners.add(sqliteErrorListener);
    return () => {
        sqliteErrorListeners.delete(sqliteErrorListener);
    };
}

export function notifySQLiteError(error: unknown): void {
    for (const listener of sqliteErrorListeners) {
        try {
            listener(error);
        } catch (listenerError) {
            console.warn('SQLite error listener failed:', listenerError);
        }
    }
}
