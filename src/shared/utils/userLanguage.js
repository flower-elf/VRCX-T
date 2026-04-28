import { languageMappings } from '@/shared/constants/language.js';

function normalizeLanguageText(value) {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

export function normalizeLanguageKey(value) {
    return normalizeLanguageText(value)
        .toLowerCase()
        .replace(/^language_/, '');
}

export function languageFlagClassName(languageKey) {
    const key = normalizeLanguageKey(languageKey);
    return languageMappings[key] || key || 'unknown';
}

export function languageDisplayName(option) {
    const key = normalizeLanguageKey(option?.key || option?.value);
    return normalizeLanguageText(
        option?.value || option?.label || option?.name || key.toUpperCase()
    );
}

export function languageOptionLabel(option) {
    const key = normalizeLanguageKey(option?.key || option?.value);
    const value = languageDisplayName(option);
    return key ? `${value || key.toUpperCase()} (${key.toUpperCase()})` : value;
}

export function fallbackLanguageOptions() {
    return Object.keys(languageMappings)
        .sort()
        .map((key) => ({ key, value: key.toUpperCase() }));
}

export function normalizeLanguageOptionsFromConfig(json) {
    const options = json?.constants?.LANGUAGE?.SPOKEN_LANGUAGE_OPTIONS;
    if (!options || typeof options !== 'object') {
        return [];
    }

    return Object.entries(options)
        .map(([key, value]) => ({
            key: normalizeLanguageKey(key),
            value: normalizeLanguageText(value)
        }))
        .filter((option) => option.key && option.value)
        .sort((left, right) => left.value.localeCompare(right.value));
}

export function normalizeProfileLanguageRows(
    profile,
    languageOptionMap = new Map()
) {
    const rows = [];
    const seen = new Set();
    const addRow = (entry) => {
        const key = normalizeLanguageKey(
            typeof entry === 'string'
                ? entry
                : entry?.key ||
                      entry?.id ||
                      entry?.value ||
                      entry?.label ||
                      entry?.name
        );
        if (!key || seen.has(key)) {
            return;
        }
        const option = languageOptionMap.get(key);
        rows.push({
            key,
            value: normalizeLanguageText(
                option?.value ||
                    entry?.value ||
                    entry?.label ||
                    entry?.name ||
                    key.toUpperCase()
            )
        });
        seen.add(key);
    };

    if (Array.isArray(profile?.$languages)) {
        profile.$languages.forEach(addRow);
    }
    if (Array.isArray(profile?.languages)) {
        profile.languages.forEach(addRow);
    }
    if (Array.isArray(profile?.tags)) {
        profile.tags.forEach((tag) => {
            const normalizedTag = normalizeLanguageText(tag).toLowerCase();
            if (normalizedTag.startsWith('language_')) {
                addRow(normalizedTag);
            }
        });
    }

    return rows;
}
