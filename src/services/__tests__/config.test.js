import { toDbKey, toLegacyDbKey } from '../configKeys.js';

describe('toDbKey', () => {
    test('converts key name to db format with vrcx-0 prefix', () => {
        expect(toDbKey('appLanguage')).toBe('config:vrcx-0_applanguage');
    });

    test('handles already lowercase key', () => {
        expect(toDbKey('bar')).toBe('config:vrcx-0_bar');
    });
});

describe('toLegacyDbKey', () => {
    test('converts key name to legacy db format without -0', () => {
        expect(toLegacyDbKey('appLanguage')).toBe('config:vrcx_applanguage');
    });
});
