import { describe, expect, it } from 'vitest';

import { links } from './link';

describe('links', () => {
    it('uses GitHub Sponsors as the donation target', () => {
        expect(links.githubSponsors).toBe('https://github.com/sponsors/Map1en');
    });

    it('uses Ko-fi as the alternate support target', () => {
        expect(links.kofi).toBe('https://ko-fi.com/map1en_');
    });
});
