import { RefreshCcwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PreviousInstancesTableDialog } from '@/components/dialogs/PreviousInstancesTableDialog';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { timeToText } from '@/lib/dateTime';
import { Button } from '@/ui/shadcn/button';
import { Separator } from '@/ui/shadcn/separator';

import { InstanceActivityDateControls } from './components/InstanceActivityDateControls';
import { InstanceActivitySettingsPopover } from './components/InstanceActivitySettingsPopover';
import {
    ChartEmptyState,
    ChartLoadingState,
    InstanceActivityDetailChart
} from './components/InstanceActivityViewParts';
import {
    getDetailGroupKeys
} from './instance-activity/instanceActivityRows';
import { useInstanceActivityPageController } from './useInstanceActivityPageController';

export function InstanceActivityPage() {
    const { t } = useTranslation();
    const {
        actions,
        chart,
        data,
        date,
        detail,
        previousInstances,
        settings
    } = useInstanceActivityPageController();

    return (
        <PageScaffold id="chart" style={{ overflowY: 'auto' }}>
            <div className="pt-12">
                <div className="options-container mt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0">
                            {t('view.charts.instance_activity.header')}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('common.actions.refresh')}
                            onClick={actions.refresh}
                        >
                            <RefreshCcwIcon data-icon="inline-start" />
                        </Button>
                        <InstanceActivitySettingsPopover
                            barWidth={settings.barWidth}
                            isDetailVisible={settings.isDetailVisible}
                            isSoloInstanceVisible={
                                settings.isSoloInstanceVisible
                            }
                            isNoFriendInstanceVisible={
                                settings.isNoFriendInstanceVisible
                            }
                            onBarWidthCommit={settings.handleBarWidthCommit}
                            onDetailVisibleChange={settings.setDetailVisible}
                            onSoloInstanceVisibleChange={
                                settings.setSoloInstanceVisible
                            }
                            onNoFriendInstanceVisibleChange={
                                settings.setNoFriendInstanceVisible
                            }
                        />
                        <InstanceActivityDateControls
                            selectedDate={date.selectedDate}
                            onSelectedDateChange={date.setSelectedDate}
                            availableDates={data.availableDates}
                            dataStatus={data.status}
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-center text-center">
                    <div>
                        <div className="text-muted-foreground text-sm">
                            {t('view.charts.instance_activity.online_time')}
                        </div>
                        <div className="text-2xl font-semibold">
                            {timeToText(chart.totalOnlineTime, true)}
                        </div>
                    </div>
                </div>

                <div className="mt-4 min-w-0">
                    {data.status === 'running' ? (
                        <ChartLoadingState />
                    ) : data.status === 'error' ? (
                        <ChartEmptyState
                            title={t(
                                'view.charts.error.instance_activity_failed_to_load'
                            )}
                            description={
                                data.detail ||
                                'The chart adapter could not read game-log instance activity for the selected day.'
                            }
                        />
                    ) : (
                        <>
                            <div
                                ref={chart.setMainChartElementRef}
                                className="w-full bg-transparent"
                            />
                            {!chart.chartRows.length ? (
                                <ChartEmptyState
                                    title={t(
                                        data.availableDates.includes(
                                            date.selectedDate
                                        )
                                            ? 'view.charts.empty.no_instance_activity_on_this_day'
                                            : 'view.charts.empty.selected_date_outside_activity_set'
                                    )}
                                />
                            ) : null}
                        </>
                    )}

                    {settings.isDetailVisible &&
                    chart.chartRows.length ? (
                        <div>
                            <div className="px-[min(25vw,400px)] py-4">
                                <div className="flex items-center">
                                    <Separator className="flex-1" />
                                    <span className="text-muted-foreground px-2">
                                        ·
                                    </span>
                                    <Separator className="flex-1" />
                                </div>
                            </div>
                            {detail.filteredDetailGroups.length ? (
                                detail.filteredDetailGroups.map((group: any) => {
                                    const detailKeys = getDetailGroupKeys(
                                        group,
                                        detail.currentUserId
                                    );
                                    const key = detailKeys[0];
                                    return (
                                        <div
                                            key={key}
                                            ref={(node: any) => {
                                                if (node) {
                                                    detailKeys.forEach(
                                                        (detailKey: any) => {
                                                            detail.detailGroupRefs.current.set(
                                                                detailKey,
                                                                node
                                                            );
                                                        }
                                                    );
                                                } else {
                                                    detailKeys.forEach(
                                                        (detailKey: any) => {
                                                            detail.detailGroupRefs.current.delete(
                                                                detailKey
                                                            );
                                                        }
                                                    );
                                                }
                                            }}
                                        >
                                            <InstanceActivityDetailChart
                                                group={group}
                                                barWidth={settings.barWidth}
                                                hour12={chart.hour12}
                                                resolvedTheme={
                                                    chart.resolvedTheme
                                                }
                                                worldDetailsById={
                                                    chart.worldDetailsById
                                                }
                                                onOpenPreviousInstanceInfo={
                                                    previousInstances.openPreviousInstanceInfo
                                                }
                                            />
                                        </div>
                                    );
                                })
                            ) : (
                                <ChartEmptyState
                                    title={t(
                                        'view.charts.empty.no_detail_charts_match_the_current_filters'
                                    )}
                                    description={t(
                                        'view.charts.empty.turn_on_solo_or_no_friend_instances_to_show_the_hidden_detail_groups'
                                    )}
                                />
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
            <PreviousInstancesTableDialog
                open={previousInstances.previousInstanceOpen}
                onOpenChange={previousInstances.setPreviousInstanceOpen}
                title={previousInstances.previousInstanceTitle}
                instances={previousInstances.previousInstanceRows}
                detailsOnly
            />
        </PageScaffold>
    );
}
