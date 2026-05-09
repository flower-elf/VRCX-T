import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.js';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Checkbox } from '@/ui/shadcn/checkbox';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle
} from '@/ui/shadcn/empty';
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/ui/shadcn/field';
import { ScrollArea } from '@/ui/shadcn/scroll-area';
import { Switch } from '@/ui/shadcn/switch';

import { updateArrayValue } from '../toolsDialogUtils.js';

export function AutomationSplitLayout({
    list,
    editor
}: {
    list: ReactNode;
    editor: ReactNode;
}) {
    return (
        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
            {list}
            {editor}
        </div>
    );
}

export function RuleSummaryBadge({ children }: { children: ReactNode }) {
    if (!children) {
        return null;
    }

    return (
        <Badge variant="secondary" className="max-w-full truncate">
            {children}
        </Badge>
    );
}

export function RuleList({
    title,
    description,
    addLabel,
    disabled,
    isEmpty,
    emptyTitle,
    emptyDescription,
    onAdd,
    children
}: {
    title: ReactNode;
    description?: ReactNode;
    addLabel: ReactNode;
    disabled?: boolean;
    isEmpty: boolean;
    emptyTitle: ReactNode;
    emptyDescription?: ReactNode;
    onAdd: () => void;
    children: ReactNode;
}) {
    return (
        <section className="bg-card/40 flex min-h-0 flex-col rounded-lg border">
            <div className="flex items-start justify-between gap-3 border-b px-3 py-2.5">
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{title}</div>
                    {description ? (
                        <div className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                            {description}
                        </div>
                    ) : null}
                </div>
                <Button
                    type="button"
                    size="sm"
                    disabled={disabled}
                    onClick={onAdd}
                >
                    <PlusIcon data-icon="inline-start" />
                    {addLabel}
                </Button>
            </div>
            <ScrollArea className="min-h-[14rem] flex-1 lg:max-h-[calc(88vh-15rem)]">
                <div className="flex flex-col gap-1.5 p-2">
                    {isEmpty ? (
                        <Empty className="min-h-[12rem] border">
                            <EmptyHeader>
                                <EmptyTitle>{emptyTitle}</EmptyTitle>
                                {emptyDescription ? (
                                    <EmptyDescription>
                                        {emptyDescription}
                                    </EmptyDescription>
                                ) : null}
                            </EmptyHeader>
                            <EmptyContent>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={disabled}
                                    onClick={onAdd}
                                >
                                    <PlusIcon data-icon="inline-start" />
                                    {addLabel}
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : (
                        children
                    )}
                </div>
            </ScrollArea>
        </section>
    );
}

export function RuleListItem({
    selected,
    title,
    description,
    badges,
    enabled,
    disabled,
    removeLabel,
    onSelect,
    onEnabledChange,
    onRemove
}: {
    selected: boolean;
    title: ReactNode;
    description?: ReactNode;
    badges?: ReactNode;
    enabled: boolean;
    disabled?: boolean;
    removeLabel: string;
    onSelect: () => void;
    onEnabledChange: (enabled: boolean) => void;
    onRemove: () => void;
}) {
    return (
        <div
            className={cn(
                'flex items-start gap-2 rounded-md border p-2 transition-colors',
                selected
                    ? 'border-primary/50 bg-accent/40'
                    : 'bg-background/40 hover:bg-accent/25'
            )}
        >
            <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={onSelect}
            >
                <div className="truncate text-sm font-medium">{title}</div>
                {description ? (
                    <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
                        {description}
                    </div>
                ) : null}
                {badges ? (
                    <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                        {badges}
                    </div>
                ) : null}
            </button>
            <div className="flex shrink-0 items-center gap-1">
                <Switch
                    checked={enabled}
                    disabled={disabled}
                    aria-label={String(title || '')}
                    onCheckedChange={onEnabledChange}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={removeLabel}
                    disabled={disabled}
                    onClick={onRemove}
                >
                    <Trash2Icon data-icon="inline-start" />
                </Button>
            </div>
        </div>
    );
}

export function RuleEditorPanel({
    title,
    description,
    children
}: {
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="bg-card/40 min-w-0 rounded-lg border">
            <div className="border-b px-3 py-2.5">
                <div className="truncate text-sm font-medium">{title}</div>
                {description ? (
                    <div className="text-muted-foreground text-xs leading-snug">
                        {description}
                    </div>
                ) : null}
            </div>
            <div className="p-3">{children}</div>
        </section>
    );
}

export function CompactCheckList({
    idPrefix,
    values,
    options,
    disabled,
    columns = 'auto',
    onChange
}: {
    idPrefix: string;
    values: string[];
    options: Array<{ value: string; label: string }>;
    disabled?: boolean;
    columns?: 'auto' | 'two';
    onChange: (next: string[]) => void;
}) {
    return (
        <FieldGroup
            data-slot="checkbox-group"
            className={cn(
                'grid gap-1.5',
                columns === 'two'
                    ? 'sm:grid-cols-2'
                    : 'sm:grid-cols-2 xl:grid-cols-3'
            )}
        >
            {options.map((option) => {
                const id = `${idPrefix}-${option.value}`;
                return (
                    <Field
                        key={option.value}
                        orientation="horizontal"
                        data-disabled={disabled}
                        className="min-h-9 rounded-md border px-2 py-1.5"
                    >
                        <Checkbox
                            id={id}
                            checked={values.includes(option.value)}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                                onChange(
                                    updateArrayValue(
                                        values,
                                        option.value,
                                        Boolean(checked)
                                    )
                                )
                            }
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={id} className="truncate">
                                {option.label}
                            </FieldLabel>
                        </FieldContent>
                    </Field>
                );
            })}
        </FieldGroup>
    );
}
