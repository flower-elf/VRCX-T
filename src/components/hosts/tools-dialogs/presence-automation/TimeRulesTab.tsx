import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { userStatusLabel } from '@/lib/userStatus.js';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle
} from '@/ui/shadcn/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/ui/shadcn/field';
import { Input } from '@/ui/shadcn/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/ui/shadcn/select';
import { Switch } from '@/ui/shadcn/switch';
import { ToggleGroup, ToggleGroupItem } from '@/ui/shadcn/toggle-group';

import { statusOptions } from '../toolsDialogUtils.js';
import {
    AutomationSplitLayout,
    RuleEditorPanel,
    RuleList,
    RuleListItem,
    RuleSummaryBadge
} from './AutomationRuleLayout.js';
import {
    createTimeRule,
    dayOptions,
    getTimeWindow,
    priorityLabelKeyFromNumber,
    priorityNumberFromValue,
    priorityOptions,
    priorityValueFromNumber,
    updateRule
} from './presenceAutomationDialogUtils.js';

const I18N_ROOT = 'view.tools.social_automation';

function hasAction(rule, key) {
    return Object.prototype.hasOwnProperty.call(rule.actions || {}, key);
}

function updateTimeWindow(rule, patch) {
    const timeWindow = getTimeWindow(rule);
    const otherConditions = (rule.conditions || []).filter(
        (condition) => condition.type !== 'timeWindow'
    );
    return {
        ...rule,
        conditions: [{ ...timeWindow, ...patch }, ...otherConditions]
    };
}

function updateAction(rule, patch) {
    return {
        ...rule,
        actions: {
            ...(rule.actions || {}),
            ...patch
        }
    };
}

function removeAction(rule, key) {
    const actions = { ...(rule.actions || {}) };
    delete actions[key];
    return {
        ...rule,
        actions
    };
}

function ruleTitle(rule, t) {
    return rule?.label || t(`${I18N_ROOT}.schedule_rule_default`);
}

function daysSummary(days, t) {
    if (!Array.isArray(days) || days.length === 0) {
        return t(`${I18N_ROOT}.every_day`);
    }
    const selectedDays = new Set(days);
    return dayOptions
        .filter((day) => selectedDays.has(day.value))
        .map((day) => t(day.labelKey))
        .join(', ');
}

function actionSummary(rule, t) {
    const parts = [];
    if (rule.actions?.status) {
        parts.push(userStatusLabel(rule.actions.status, t));
    }
    if (hasAction(rule, 'statusDescription')) {
        parts.push(t(`${I18N_ROOT}.signature`));
    }
    return parts.length ? parts.join(' / ') : t(`${I18N_ROOT}.do_not_change`);
}

export function TimeRulesTab({ rules, disabled, onRulesChange }) {
    const { t } = useTranslation();
    const [selectedRuleId, setSelectedRuleId] = useState(null);

    useEffect(() => {
        if (!rules.length) {
            setSelectedRuleId(null);
            return;
        }
        if (!rules.some((rule) => rule.id === selectedRuleId)) {
            setSelectedRuleId(rules[0].id);
        }
    }, [rules, selectedRuleId]);

    const selectedRule = useMemo(
        () => rules.find((rule) => rule.id === selectedRuleId) || null,
        [rules, selectedRuleId]
    );
    const selectedTimeWindow = selectedRule
        ? getTimeWindow(selectedRule)
        : null;

    function update(ruleId, updater) {
        onRulesChange(updateRule(rules, ruleId, updater));
    }

    function addRule() {
        const nextRule = createTimeRule(
            t(`${I18N_ROOT}.scheduled_presence_default`)
        );
        setSelectedRuleId(nextRule.id);
        onRulesChange([...rules, nextRule]);
    }

    function removeRule(ruleId) {
        const ruleIndex = rules.findIndex((rule) => rule.id === ruleId);
        const nextRules = rules.filter((rule) => rule.id !== ruleId);
        if (selectedRuleId === ruleId) {
            setSelectedRuleId(
                nextRules[Math.min(ruleIndex, nextRules.length - 1)]?.id ?? null
            );
        }
        onRulesChange(nextRules);
    }

    const list = (
        <RuleList
            title={t(`${I18N_ROOT}.schedule_rules`)}
            description={t(`${I18N_ROOT}.schedule_rules_description`)}
            addLabel={t(`${I18N_ROOT}.add_rule`)}
            disabled={disabled}
            isEmpty={!rules.length}
            emptyTitle={t(`${I18N_ROOT}.no_schedule_rules`)}
            emptyDescription={t(`${I18N_ROOT}.schedule_rules_description`)}
            onAdd={addRule}
        >
            {rules.map((rule) => {
                const timeWindow = getTimeWindow(rule);
                return (
                    <RuleListItem
                        key={rule.id}
                        selected={rule.id === selectedRuleId}
                        title={ruleTitle(rule, t)}
                        description={`${timeWindow.start} - ${timeWindow.end} / ${daysSummary(
                            timeWindow.days,
                            t
                        )}`}
                        enabled={rule.enabled !== false}
                        disabled={disabled}
                        removeLabel={t(`${I18N_ROOT}.remove_schedule_rule`)}
                        badges={
                            <>
                                <RuleSummaryBadge>
                                    {t(
                                        priorityLabelKeyFromNumber(
                                            rule.priority,
                                            'high'
                                        )
                                    )}
                                </RuleSummaryBadge>
                                <RuleSummaryBadge>
                                    {actionSummary(rule, t)}
                                </RuleSummaryBadge>
                            </>
                        }
                        onSelect={() => setSelectedRuleId(rule.id)}
                        onEnabledChange={(checked) =>
                            update(rule.id, (current) => ({
                                ...current,
                                enabled: checked
                            }))
                        }
                        onRemove={() => removeRule(rule.id)}
                    />
                );
            })}
        </RuleList>
    );

    const editor = (
        <RuleEditorPanel
            title={
                selectedRule
                    ? ruleTitle(selectedRule, t)
                    : t(`${I18N_ROOT}.schedule_rule_default`)
            }
            description={
                selectedTimeWindow
                    ? `${selectedTimeWindow.start} - ${selectedTimeWindow.end}`
                    : t(`${I18N_ROOT}.no_schedule_rules`)
            }
        >
            {selectedRule && selectedTimeWindow ? (
                <FieldGroup>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.rule_name`)}</FieldLabel>
                            <Input
                                value={selectedRule.label || ''}
                                disabled={disabled}
                                onChange={(event) =>
                                    update(selectedRule.id, (current) => ({
                                        ...current,
                                        label: event.target.value
                                    }))
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.priority`)}</FieldLabel>
                            <Select
                                value={priorityValueFromNumber(
                                    selectedRule.priority,
                                    'high'
                                )}
                                disabled={disabled}
                                onValueChange={(value) =>
                                    update(selectedRule.id, (current) => ({
                                        ...current,
                                        priority: priorityNumberFromValue(
                                            value,
                                            700
                                        )
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {priorityOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {t(option.labelKey)}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.start`)}</FieldLabel>
                            <Input
                                type="time"
                                value={selectedTimeWindow.start}
                                disabled={disabled}
                                onChange={(event) =>
                                    update(selectedRule.id, (current) =>
                                        updateTimeWindow(current, {
                                            start: event.target.value
                                        })
                                    )
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.end`)}</FieldLabel>
                            <Input
                                type="time"
                                value={selectedTimeWindow.end}
                                disabled={disabled}
                                onChange={(event) =>
                                    update(selectedRule.id, (current) =>
                                        updateTimeWindow(current, {
                                            end: event.target.value
                                        })
                                    )
                                }
                            />
                        </Field>
                    </div>
                    <Field>
                        <FieldLabel>{t(`${I18N_ROOT}.days`)}</FieldLabel>
                        <FieldDescription>
                            {t(`${I18N_ROOT}.run_every_day_hint`)}
                        </FieldDescription>
                        <ToggleGroup
                            type="multiple"
                            variant="outline"
                            size="sm"
                            spacing={1}
                            disabled={disabled}
                            value={(selectedTimeWindow.days || []).map(String)}
                            className="flex flex-wrap"
                            onValueChange={(values) =>
                                update(selectedRule.id, (current) =>
                                    updateTimeWindow(current, {
                                        days: values.map((value) =>
                                            Number.parseInt(value, 10)
                                        )
                                    })
                                )
                            }
                        >
                            {dayOptions.map((day) => (
                                <ToggleGroupItem
                                    key={day.value}
                                    value={String(day.value)}
                                    disabled={disabled}
                                >
                                    {t(day.labelKey)}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.status`)}</FieldLabel>
                            <Select
                                value={
                                    selectedRule.actions?.status || 'no-change'
                                }
                                disabled={disabled}
                                onValueChange={(value) =>
                                    update(selectedRule.id, (current) =>
                                        value === 'no-change'
                                            ? removeAction(current, 'status')
                                            : updateAction(current, {
                                                  status: value
                                              })
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="no-change">
                                            {t(`${I18N_ROOT}.do_not_change`)}
                                        </SelectItem>
                                        {statusOptions.map((status) => (
                                            <SelectItem
                                                key={status}
                                                value={status}
                                            >
                                                {userStatusLabel(status, t)}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel>{t(`${I18N_ROOT}.signature`)}</FieldLabel>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={hasAction(
                                        selectedRule,
                                        'statusDescription'
                                    )}
                                    disabled={disabled}
                                    onCheckedChange={(checked) =>
                                        update(selectedRule.id, (current) =>
                                            checked
                                                ? updateAction(current, {
                                                      statusDescription: ''
                                                  })
                                                : removeAction(
                                                      current,
                                                      'statusDescription'
                                                  )
                                        )
                                    }
                                />
                                <span className="text-muted-foreground text-sm">
                                    {t(`${I18N_ROOT}.change_signature`)}
                                </span>
                            </div>
                            {hasAction(selectedRule, 'statusDescription') ? (
                                <Input
                                    value={
                                        selectedRule.actions
                                            ?.statusDescription || ''
                                    }
                                    maxLength={32}
                                    disabled={disabled}
                                    onChange={(event) =>
                                        update(selectedRule.id, (current) =>
                                            updateAction(current, {
                                                statusDescription:
                                                    event.target.value
                                            })
                                        )
                                    }
                                />
                            ) : null}
                        </Field>
                    </div>
                </FieldGroup>
            ) : (
                <Empty className="min-h-[18rem] border">
                    <EmptyHeader>
                        <EmptyTitle>
                            {t(`${I18N_ROOT}.no_schedule_rules`)}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t(`${I18N_ROOT}.schedule_rules_description`)}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </RuleEditorPanel>
    );

    return <AutomationSplitLayout list={list} editor={editor} />;
}
