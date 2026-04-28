import {
    CheckIcon,
    EyeIcon,
    ImageIcon,
    MoreHorizontalIcon,
    PencilIcon,
    RefreshCwIcon,
    TagIcon,
    UserIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getAvailablePlatforms } from '@/lib/avatarPlatform.js';
import { cn } from '@/lib/utils.js';
import { getTagColor } from '@/shared/constants/tags.js';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from '@/ui/shadcn/context-menu';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/ui/shadcn/dropdown-menu';
import { Spinner } from '@/ui/shadcn/spinner';

import { resolveMyAvatarActionDisabled } from '../myAvatarsDisplay.js';

export function AvatarActionMenuItems({
    avatar,
    isActive,
    disabled,
    Item,
    Group,
    Separator,
    onAction
}) {
    const { t } = useTranslation();

    const releaseAction =
        avatar?.releaseStatus === 'public' ? 'makePrivate' : 'makePublic';

    const stopMenuClick = (event) => {
        event.stopPropagation();
    };

    const handleAction = (action) => {
        onAction(action, avatar);
    };

    const actionItemProps = (action) => ({
        onClick: stopMenuClick,
        onSelect: (event) => {
            event.stopPropagation?.();
            handleAction(action);
        }
    });

    return (
        <>
            <Group>
                <Item {...actionItemProps('details')}>
                    <EyeIcon />
                    {t('common.actions.view_details')}
                </Item>
                <Item
                    disabled={disabled || isActive}
                    {...actionItemProps('wear')}
                >
                    <CheckIcon />
                    {t('dialog.avatar.actions.select')}
                </Item>
            </Group>
            <Separator />
            <Group>
                <Item
                    disabled={disabled}
                    {...actionItemProps('manageTags')}
                >
                    <TagIcon />
                    {t('dialog.avatar.actions.manage_tags')}
                </Item>
                <Item
                    disabled={disabled}
                    {...actionItemProps('editDetails')}
                >
                    <PencilIcon />
                    {t('dialog.avatar.actions.edit_details')}
                </Item>
                <Item
                    disabled={disabled}
                    {...actionItemProps('changeContentTags')}
                >
                    <TagIcon />
                    {t('dialog.avatar.actions.change_content_tags')}
                </Item>
                <Item
                    disabled={disabled}
                    {...actionItemProps('changeImage')}
                >
                    <ImageIcon />
                    {t('dialog.avatar.actions.change_image')}
                </Item>
            </Group>
            <Separator />
            <Group>
                <Item
                    disabled={disabled}
                    {...actionItemProps(releaseAction)}
                >
                    <UserIcon />
                    {avatar?.releaseStatus === 'public'
                        ? t('dialog.avatar.actions.make_private')
                        : t('dialog.avatar.actions.make_public')}
                </Item>
                <Item
                    disabled={disabled}
                    {...actionItemProps('createImpostor')}
                >
                    <RefreshCwIcon />
                    {t('dialog.avatar.actions.create_impostor')}
                </Item>
            </Group>
        </>
    );
}

export function MyAvatarGridCard({
    avatar,
    currentAvatarId,
    densityConfig,
    isUpdating,
    onAction
}) {
    const { t } = useTranslation();

    const isActive = avatar?.id === currentAvatarId;
    const platforms = getAvailablePlatforms(avatar?.unityPackages);
    const disabled = resolveMyAvatarActionDisabled(avatar, isUpdating);
    const canWear = !disabled && !isActive;
    const tags = avatar?.$tags || [];
    const visibleTags = tags.slice(0, densityConfig.maxVisibleTags);
    const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);
    const platformDotClassName =
        'size-2.5 rounded-full border border-background/80 opacity-80 shadow-sm';

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div className="group/card relative min-w-0">
                    <Button
                        type="button"
                        variant="outline"
                        className={cn(
                            'h-auto min-w-0 flex-col items-stretch overflow-hidden p-0 text-left font-normal whitespace-normal',
                            disabled && 'cursor-not-allowed opacity-60',
                            isActive && 'ring-primary ring-2'
                        )}
                        aria-disabled={!canWear}
                        tabIndex={disabled ? -1 : undefined}
                        onClick={() => {
                            if (!canWear) {
                                return;
                            }
                            onAction('wear', avatar);
                        }}
                    >
                        <div
                            className="bg-muted relative w-full overflow-hidden"
                            style={{
                                aspectRatio: `${1 / densityConfig.imageHeightRatio}`
                            }}
                        >
                            {avatar?.thumbnailImageUrl ? (
                                <img
                                    src={avatar.thumbnailImageUrl}
                                    alt={avatar?.name || 'Avatar'}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="text-muted-foreground grid h-full w-full place-items-center [&>svg]:size-6">
                                    <ImageIcon />
                                </div>
                            )}
                            {isActive ? (
                                <Badge
                                    variant="secondary"
                                    className="absolute top-1 left-1 max-w-[calc(100%-2rem)] truncate rounded-sm px-1.5 py-0 text-xs"
                                >
                                    {t('view.my_avatars.generated.current_avatar')}
                                </Badge>
                            ) : null}
                            {canWear ? (
                                <div className="from-background/85 absolute right-0 bottom-0 left-0 translate-y-full bg-gradient-to-t to-transparent px-2 py-1 text-xs font-medium transition-transform group-hover/card:translate-y-0 group-focus-within/card:translate-y-0">
                                    {t('view.my_avatars.generated.click_to_wear')}
                                </div>
                            ) : null}
                            {platforms?.isQuest || platforms?.isIos ? (
                                <div className="absolute top-1 right-1 flex -space-x-1">
                                    {platforms?.isPC ? (
                                        <span
                                            className={cn(
                                                platformDotClassName,
                                                'bg-platform-pc'
                                            )}
                                        />
                                    ) : null}
                                    {platforms?.isQuest ? (
                                        <span
                                            className={cn(
                                                platformDotClassName,
                                                'bg-platform-quest'
                                            )}
                                        />
                                    ) : null}
                                    {platforms?.isIos ? (
                                        <span
                                            className={cn(
                                                platformDotClassName,
                                                'bg-platform-ios'
                                            )}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        <div
                            className="flex min-h-0 flex-col"
                            style={{
                                gap: `${densityConfig.bodyGap}px`,
                                padding: `${densityConfig.bodyPaddingY}px ${densityConfig.bodyPaddingX}px`
                            }}
                        >
                            <span
                                className="line-clamp-2 block overflow-hidden"
                                style={{
                                    fontSize: `${densityConfig.nameFontSize}px`,
                                    lineHeight: densityConfig.nameLineHeight,
                                    minHeight: `${densityConfig.nameFontSize * densityConfig.nameLineHeight * densityConfig.nameLines}px`
                                }}
                            >
                                {avatar?.name ||
                                    t(
                                        'view.my_avatars.generated.untitled_avatar'
                                    )}
                            </span>
                            {tags.length ? (
                                <div
                                    className="flex flex-nowrap gap-0.5 overflow-hidden"
                                    style={{
                                        maxHeight: `${densityConfig.tagHeight}px`
                                    }}
                                >
                                    {visibleTags.map((entry) => {
                                        const color = getTagColor(entry.tag);
                                        return (
                                            <Badge
                                                key={`${avatar.id}:${entry.tag}`}
                                                variant="outline"
                                                className="shrink-0 rounded-sm px-1 py-0 leading-tight"
                                                style={{
                                                    fontSize: `${densityConfig.tagFontSize}px`,
                                                    borderColor: color.bg,
                                                    color: color.text
                                                }}
                                            >
                                                {entry.tag}
                                            </Badge>
                                        );
                                    })}
                                    {hiddenTagCount ? (
                                        <Badge
                                            variant="secondary"
                                            className="shrink-0 rounded-sm px-1 py-0 leading-tight"
                                            style={{
                                                fontSize: `${densityConfig.tagFontSize}px`
                                            }}
                                        >
                                            +{hiddenTagCount}
                                        </Badge>
                                    ) : null}
                                </div>
                            ) : (
                                <div
                                    aria-hidden="true"
                                    style={{
                                        height: `${densityConfig.tagHeight}px`
                                    }}
                                />
                            )}
                        </div>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon-xs"
                                className="absolute top-1 right-1 opacity-0 shadow-sm transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 data-[state=open]:opacity-100"
                                aria-label={t(
                                    'view.my_avatars.generated.open_avatar_actions'
                                )}
                                disabled={isUpdating}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => event.stopPropagation()}
                            >
                                {isUpdating ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <MoreHorizontalIcon data-icon="inline-start" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-max min-w-52 max-w-[90vw]"
                        >
                            <AvatarActionMenuItems
                                avatar={avatar}
                                isActive={isActive}
                                disabled={disabled}
                                Item={DropdownMenuItem}
                                Group={DropdownMenuGroup}
                                Separator={DropdownMenuSeparator}
                                onAction={onAction}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-max min-w-52 max-w-[90vw]">
                <AvatarActionMenuItems
                    avatar={avatar}
                    isActive={isActive}
                    disabled={disabled}
                    Item={ContextMenuItem}
                    Group={ContextMenuGroup}
                    Separator={ContextMenuSeparator}
                    onAction={onAction}
                />
            </ContextMenuContent>
        </ContextMenu>
    );
}
