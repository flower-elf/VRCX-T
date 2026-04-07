import sqliteService from './sqlite.js';
import { ConfigKeys, toDbKey } from './configKeys.js';

/**
 * ConfigRepository — centralized config access with batch loading.
 *
 * On init(), all configs are loaded into memory (single SELECT).
 * Reads are instant Map lookups. Writes update the Map + async DB write.
 */
class ConfigRepository {
    /** @type {Map<string, string>} dbKey → raw string value */
    #cache = new Map();
    #loaded = false;

    async init() {
        await sqliteService.executeNonQuery(
            'CREATE TABLE IF NOT EXISTS configs (`key` TEXT PRIMARY KEY, `value` TEXT)'
        );

        await sqliteService.execute(
            (row) => {
                if (row[0] != null && row[1] != null) {
                    this.#cache.set(row[0], row[1]);
                }
            },
            'SELECT key, value FROM configs'
        );

        this.#loaded = true;
    }

    // ─── Key resolution ─────────────────────────────────────

    /**
     * Resolve a user-facing key name to the internal DB key.
     *
     * Accepts:
     *   - Plain name: "appLanguage" → "config:vrcx_applanguage"
     *   - Prefixed:   "VRCX_appLanguage" → "config:vrcx_applanguage"
     *   - Dynamic:    "friendLogInit_usr_xxx" → "config:vrcx_friendloginit_usr_xxx"
     *   - Legacy full: "config:..." → passthrough
     */
    #resolveKey(key) {
        if (key.startsWith('config:')) return key;
        const stripped = key.startsWith('VRCX_') ? key.slice(5) : key;
        return `config:vrcx_${stripped.toLowerCase()}`;
    }

    /**
     * Look up default from ConfigKeys schema.
     */
    #getSchemaDefault(key) {
        const stripped = key.startsWith('VRCX_') ? key.slice(5) : key;
        const schema = ConfigKeys[stripped];
        return schema?.default ?? null;
    }

    // ─── Read methods ───────────────────────────────────────

    /**
     * Get raw string value from cache.
     * Does NOT apply schema defaults — typed methods handle that.
     *
     * @param {string} key
     * @param {string|null} [defaultValue]
     * @returns {Promise<string|null>}
     */
    async getString(key, defaultValue = null) {
        const dbKey = this.#resolveKey(key);
        const value = this.#cache.get(dbKey);

        if (value !== null && value !== undefined && value !== 'undefined') {
            return value;
        }

        if (defaultValue !== null) return defaultValue;
        return this.#getSchemaDefault(key);
    }

    /**
     * @param {string} key
     * @param {boolean|null} [defaultValue]
     * @returns {Promise<boolean|null>}
     */
    async getBool(key, defaultValue = undefined) {
        const dbKey = this.#resolveKey(key);
        const raw = this.#cache.get(dbKey);

        if (raw !== null && raw !== undefined && raw !== 'undefined') {
            return raw === 'true';
        }

        if (defaultValue !== undefined) return defaultValue;
        return this.#getSchemaDefault(key);
    }

    /**
     * @param {string} key
     * @param {number|null} [defaultValue]
     * @returns {Promise<number|null>}
     */
    async getInt(key, defaultValue = undefined) {
        const dbKey = this.#resolveKey(key);
        const raw = this.#cache.get(dbKey);

        if (raw !== null && raw !== undefined && raw !== 'undefined') {
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) return parsed;
        }

        if (defaultValue !== undefined) return defaultValue;
        return this.#getSchemaDefault(key);
    }

    /**
     * @param {string} key
     * @param {number|null} [defaultValue]
     * @returns {Promise<number|null>}
     */
    async getFloat(key, defaultValue = undefined) {
        const dbKey = this.#resolveKey(key);
        const raw = this.#cache.get(dbKey);

        if (raw !== null && raw !== undefined && raw !== 'undefined') {
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) return parsed;
        }

        if (defaultValue !== undefined) return defaultValue;
        return this.#getSchemaDefault(key);
    }

    /**
     * @param {string} key
     * @param {object|null} [defaultValue]
     * @returns {Promise<object|null>}
     */
    async getObject(key, defaultValue = null) {
        const value = await this.getString(key);
        if (value === null || value === undefined) return defaultValue;
        try {
            const parsed = JSON.parse(value);
            if (parsed !== Object(parsed)) return defaultValue;
            return parsed;
        } catch {
            return defaultValue;
        }
    }

    /**
     * @param {string} key
     * @param {Array|null} [defaultValue]
     * @returns {Promise<Array|null>}
     */
    async getArray(key, defaultValue = null) {
        const value = await this.getObject(key, null);
        if (!Array.isArray(value)) return defaultValue;
        return value;
    }

    /**
     * Get raw value without any parsing. For internal/debug use.
     */
    async getRawValue(key) {
        const dbKey = this.#resolveKey(key);
        const value = this.#cache.get(dbKey);
        if (value === null || value === undefined || value === 'undefined') {
            return null;
        }
        return value;
    }

    // ─── Write methods ──────────────────────────────────────

    /**
     * @param {string} key
     * @param {string} value
     */
    async setString(key, value) {
        const dbKey = this.#resolveKey(key);
        const strValue = String(value);
        this.#cache.set(dbKey, strValue);
        await sqliteService.executeNonQuery(
            'INSERT OR REPLACE INTO configs (key, value) VALUES (@key, @value)',
            { '@key': dbKey, '@value': strValue }
        );
    }

    async setBool(key, value) {
        await this.setString(key, value ? 'true' : 'false');
    }

    async setInt(key, value) {
        await this.setString(key, value);
    }

    async setFloat(key, value) {
        await this.setString(key, value);
    }

    async setObject(key, value) {
        await this.setString(key, JSON.stringify(value));
    }

    async setArray(key, value) {
        await this.setObject(key, value);
    }

    // ─── Delete ─────────────────────────────────────────────

    async remove(key) {
        const dbKey = this.#resolveKey(key);
        this.#cache.delete(dbKey);
        await sqliteService.executeNonQuery(
            'DELETE FROM configs WHERE key = @key',
            { '@key': dbKey }
        );
    }
}

var self = new ConfigRepository();
window.configRepository = self;

export { self as default, ConfigRepository };
