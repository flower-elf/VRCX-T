import { PageScaffold } from '@/components/layout/PageScaffold';

import {
    MutualFriendsGraphStage,
    MutualFriendsToolbar
} from './components/MutualFriendsGraphSections';
import { useMutualFriendsPageController } from './useMutualFriendsPageController';

export function MutualFriendsPage() {
    const { actions, exclusions, fetch, graph, layout, picker } =
        useMutualFriendsPageController();

    return (
        <PageScaffold id="chart" style={{ overflowY: 'auto' }}>
            <div className="mt-0 flex min-h-0 flex-1 flex-col items-center pt-12">
                <MutualFriendsToolbar
                    exclusions={exclusions}
                    fetch={fetch}
                    graph={graph}
                    layout={layout}
                    mutualCommands={actions}
                    picker={picker}
                />

                <div className="mt-3 w-full flex-1">
                    <MutualFriendsGraphStage
                        baseNodeCount={graph.baseGraph.nodes.length}
                        detail={graph.detail}
                        filteredNodeCount={graph.filteredGraph.nodes.length}
                        onGraphElementRef={graph.setGraphElementRef}
                        status={graph.status}
                    />
                </div>
            </div>
        </PageScaffold>
    );
}
