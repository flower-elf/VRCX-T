import { describe, expect, it } from 'vitest';

import {
    priorityLabelKeyFromNumber,
    priorityNumberFromValue,
    priorityValueFromNumber
} from './presenceAutomationDialogUtils';

describe('presenceAutomationDialogUtils priority mapping', () => {
    it('maps numeric priorities to high, medium, and low buckets', () => {
        expect(priorityValueFromNumber(700)).toBe('high');
        expect(priorityValueFromNumber(600)).toBe('high');
        expect(priorityValueFromNumber(599)).toBe('medium');
        expect(priorityValueFromNumber(300)).toBe('medium');
        expect(priorityValueFromNumber(299)).toBe('low');
        expect(priorityValueFromNumber('100')).toBe('low');
    });

    it('falls back for non-finite priority values', () => {
        expect(priorityValueFromNumber('bad')).toBe('medium');
        expect(priorityValueFromNumber(undefined, 'low')).toBe('low');
        expect(priorityValueFromNumber(Number.POSITIVE_INFINITY, 'high')).toBe(
            'high'
        );
    });

    it('resolves priority label keys through the numeric bucket fallback', () => {
        expect(priorityLabelKeyFromNumber(700)).toBe(
            'view.tools.social_automation.priority_high'
        );
        expect(priorityLabelKeyFromNumber(400)).toBe(
            'view.tools.social_automation.priority_medium'
        );
        expect(priorityLabelKeyFromNumber(100)).toBe(
            'view.tools.social_automation.priority_low'
        );
        expect(priorityLabelKeyFromNumber('bad', 'low')).toBe(
            'view.tools.social_automation.priority_low'
        );
        expect(priorityLabelKeyFromNumber('bad', 'unknown')).toBe(
            'view.tools.social_automation.priority_medium'
        );
    });

    it('maps priority select values back to rule numbers', () => {
        expect(priorityNumberFromValue('high')).toBe(700);
        expect(priorityNumberFromValue('medium')).toBe(400);
        expect(priorityNumberFromValue('low')).toBe(100);
        expect(priorityNumberFromValue('unknown')).toBe(400);
        expect(priorityNumberFromValue(undefined, 123)).toBe(123);
    });
});
