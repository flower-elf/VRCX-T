import { toDbKey } from '../configKeys.js';

describe('toDbKey', () => {
    test('converts key name to db format with vrcx prefix', () => {
        expect(toDbKey('appLanguage')).toBe('config:vrcx_applanguage');
    });

    test('handles already lowercase key', () => {
        expect(toDbKey('bar')).toBe('config:vrcx_bar');
    });
});
