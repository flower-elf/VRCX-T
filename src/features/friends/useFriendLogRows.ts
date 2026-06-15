import { useEffect, useMemo, useRef, useState } from 'react';

import friendLogHistoryRepository from '@/repositories/friendLogHistoryRepository';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import { matchesSearch, normalizeUserId, sortRows } from './friendLogRows';
import { useFriendLogResolvedNames } from './useFriendLogResolvedNames';

export function useFriendLogRows({
    refreshToken,
    searchQuery,
    selectedTypes
}: {
    refreshToken: number;
    searchQuery: string;
    selectedTypes: any[];
}) {
    const currentUserId = useRuntimeStore(
        (state: any) => state.auth.currentUserId
    );
    const hideUnfriends = usePreferencesStore(
        (state: any) => state.hideUnfriends
    );
    const [rows, setRows] = useState<any[]>([]);
    const [rowsOwnerUserId, setRowsOwnerUserId] = useState('');
    const [loadStatus, setLoadStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const rowsOwnerUserIdRef = useRef('');

    function updateRowsOwnerUserId(ownerUserId: any) {
        const normalizedOwnerUserId = normalizeUserId(ownerUserId);
        rowsOwnerUserIdRef.current = normalizedOwnerUserId;
        setRowsOwnerUserId(normalizedOwnerUserId);
    }

    useEffect(() => {
        let active = true;

        if (!currentUserId) {
            setRows([]);
            updateRowsOwnerUserId('');
            setLoadStatus('idle');
            setDetail('No authenticated user is available for friend history.');
            return () => {
                active = false;
            };
        }

        setLoadStatus('running');
        setDetail('');
        setRows([]);
        updateRowsOwnerUserId(currentUserId);

        friendLogHistoryRepository
            .getFriendLogHistory(currentUserId)
            .then((nextRows: any) => {
                if (!active) {
                    return;
                }

                setRows(Array.isArray(nextRows) ? nextRows : []);
                updateRowsOwnerUserId(currentUserId);
                setLoadStatus('ready');
                setDetail('');
            })
            .catch(() => {
                if (!active) {
                    return;
                }

                setRows([]);
                updateRowsOwnerUserId(currentUserId);
                setLoadStatus('error');
                setDetail('');
            });

        return () => {
            active = false;
        };
    }, [currentUserId, refreshToken]);

    const resolveDisplayName = useFriendLogResolvedNames(currentUserId, rows);

    const filteredRows = useMemo(() => {
        const activeTypeSet = selectedTypes.length
            ? new Set(selectedTypes)
            : null;

        const result: any[] = [];
        for (const row of rows) {
            if (hideUnfriends && row?.type === 'Unfriend') {
                continue;
            }
            if (activeTypeSet && !activeTypeSet.has(row?.type)) {
                continue;
            }
            const enrichedRow = {
                ...row,
                resolvedDisplayName: resolveDisplayName(row)
            };
            if (!matchesSearch(enrichedRow, searchQuery)) {
                continue;
            }
            result.push(enrichedRow);
        }
        return result;
    }, [hideUnfriends, rows, resolveDisplayName, searchQuery, selectedTypes]);

    const orderedRows = useMemo(() => sortRows(filteredRows), [filteredRows]);

    return {
        currentUserId,
        detail,
        hideUnfriends,
        loadStatus,
        orderedRows,
        rows,
        rowsOwnerUserId,
        rowsOwnerUserIdRef,
        setDetail,
        setRows
    };
}
