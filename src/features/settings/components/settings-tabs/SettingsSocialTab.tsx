import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MINUTES_PER_DAY } from '@/shared/constants/time';
import { Button } from '@/ui/shadcn/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/ui/shadcn/dropdown-menu';
import { Input } from '@/ui/shadcn/input';
import { Switch } from '@/ui/shadcn/switch';

import { Field, SettingsGroup } from '../SettingsField';
import { SettingsTabContent } from '../SettingsViewParts';

export function SettingsSocialTab({ social }: any) {
    const {
        prefs,
        selectedFavoriteFriendGroupLabel,
        favoriteFriendGroupOptions,
        remoteFavoriteFriendGroupOptions,
        localFavoriteFriendGroupOptions,
        localFavoriteFriendsGroups,
        onRecentActionCooldownEnabledChange,
        onRecentActionCooldownMinutesChange,
        onRecentActionCooldownMinutesBlur,
        onToggleLocalFavoriteFriendsGroup
    } = social;
    const { t } = useTranslation();
    const favoriteGroupLabel =
        selectedFavoriteFriendGroupLabel ||
        t('view.settings.general.favorites.group_placeholder');

    return (
        <SettingsTabContent value="social">
            <SettingsGroup title={t('view.settings.social.interaction.header')}>
                <Field
                    label={t(
                        'view.settings.appearance.user_dialog.recent_action_cooldown'
                    )}
                    description={t(
                        'view.settings.appearance.user_dialog.recent_action_cooldown_description'
                    )}
                >
                    <div className="flex items-center gap-3">
                        <Switch
                            checked={prefs.recentActionCooldownEnabled}
                            onCheckedChange={
                                onRecentActionCooldownEnabledChange
                            }
                        />
                        {prefs.recentActionCooldownEnabled ? (
                            <Input
                                type="number"
                                min={1}
                                max={MINUTES_PER_DAY}
                                className="w-28"
                                value={prefs.recentActionCooldownMinutes}
                                onChange={(event: any) =>
                                    onRecentActionCooldownMinutesChange(
                                        event.target.value
                                    )
                                }
                                onBlur={(event: any) =>
                                    onRecentActionCooldownMinutesBlur(
                                        event.target.value
                                    )
                                }
                            />
                        ) : null}
                    </div>
                </Field>
            </SettingsGroup>
            <SettingsGroup title={t('view.settings.social.favorites.header')}>
                <Field
                    label={t('view.settings.general.favorites.header')}
                    description={t(
                        'view.settings.general.favorites.header_tooltip'
                    )}
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-56 justify-between"
                            >
                                <span className="truncate">
                                    {favoriteGroupLabel}
                                </span>
                                <ChevronDownIcon
                                    data-icon="inline-end"
                                    className="opacity-50"
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {favoriteFriendGroupOptions.length ? (
                                <>
                                    <DropdownMenuGroup>
                                        {remoteFavoriteFriendGroupOptions.map(
                                            (group: any) => (
                                                <DropdownMenuCheckboxItem
                                                    key={group.value}
                                                    checked={localFavoriteFriendsGroups.includes(
                                                        group.value
                                                    )}
                                                    onSelect={(event: any) =>
                                                        event.preventDefault()
                                                    }
                                                    onCheckedChange={(
                                                        checked: any
                                                    ) =>
                                                        onToggleLocalFavoriteFriendsGroup(
                                                            group.value,
                                                            checked
                                                        )
                                                    }
                                                >
                                                    {group.label}
                                                </DropdownMenuCheckboxItem>
                                            )
                                        )}
                                    </DropdownMenuGroup>
                                    {remoteFavoriteFriendGroupOptions.length &&
                                    localFavoriteFriendGroupOptions.length ? (
                                        <DropdownMenuSeparator />
                                    ) : null}
                                    <DropdownMenuGroup>
                                        {localFavoriteFriendGroupOptions.map(
                                            (group: any) => (
                                                <DropdownMenuCheckboxItem
                                                    key={group.value}
                                                    checked={localFavoriteFriendsGroups.includes(
                                                        group.value
                                                    )}
                                                    onSelect={(event: any) =>
                                                        event.preventDefault()
                                                    }
                                                    onCheckedChange={(
                                                        checked: any
                                                    ) =>
                                                        onToggleLocalFavoriteFriendsGroup(
                                                            group.value,
                                                            checked
                                                        )
                                                    }
                                                >
                                                    {group.label}
                                                </DropdownMenuCheckboxItem>
                                            )
                                        )}
                                    </DropdownMenuGroup>
                                </>
                            ) : (
                                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                    {t(
                                        'view.settings.general.favorites.group_placeholder'
                                    )}
                                </div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Field>
            </SettingsGroup>
        </SettingsTabContent>
    );
}
