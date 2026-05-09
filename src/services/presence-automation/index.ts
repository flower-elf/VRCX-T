import { buildPresenceFacts } from './presenceFacts.js';
import { loadPresenceAutomationConfig } from './presenceConfig.js';
import { applyPresenceAutomationResult } from './presenceExecutor.js';
import { evaluatePresenceRules } from './presenceRuleEngine.js';

export async function runPresenceAutomation({ now = new Date() } = {}) {
    const config = await loadPresenceAutomationConfig();
    if (!config.enabled) {
        return {
            facts: null,
            config,
            result: {
                patch: {},
                matchedRules: [],
                skippedRules: [],
                explanation: {
                    matchedRuleCount: 0,
                    skippedRuleCount: 0
                }
            },
            applied: {
                applied: false,
                reason: 'disabled'
            }
        };
    }
    const facts = await buildPresenceFacts({ now });
    const result = evaluatePresenceRules({
        facts,
        rules: config.rules
    });
    const applied = await applyPresenceAutomationResult({
        facts,
        result,
        throttle: config.throttle
    });
    return {
        facts,
        config,
        result,
        applied
    };
}

export { buildPresenceFacts } from './presenceFacts.js';
export { loadPresenceAutomationConfig } from './presenceConfig.js';
export {
    applyPresenceAutomationResult,
    resetPresenceAutomationExecutor
} from './presenceExecutor.js';
export { evaluatePresenceRules } from './presenceRuleEngine.js';
