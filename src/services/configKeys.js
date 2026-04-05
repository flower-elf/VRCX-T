/**
 * Centralized config key registry.
 *
 * Every config key lives here. Adding a new setting =
 * add one line to this file + use it anywhere via configRepository.
 *
 * DB storage format: "config:vrcx-0_{key_lowercase}"
 * Legacy format:     "config:vrcx_{key_lowercase}"  (auto-migrated on first read)
 */

export const ConfigKeys = {
    // ── App Core ─────────────────────────────────────
    databaseVersion: { type: 'int', default: 0 },
    appLanguage: { type: 'string', default: null },
    maxTableSize_v2: { type: 'int', default: 500 },
    searchLimit: { type: 'int', default: 50000 },
    clearVRCXCacheFrequency: { type: 'int', default: 172800 },
    autoUpdateVRCX: { type: 'string', default: 'Auto Download' },
    id: { type: 'string', default: '' },
    branch: { type: 'string', default: '' },
    enableCustomEndpoint: { type: 'bool', default: false },

    // ── Sidebar ──────────────────────────────────────
    isFriendsGroupMe: { type: 'bool', default: true },
    isFriendsGroupFavorites: { type: 'bool', default: true },
    isFriendsGroupOnline: { type: 'bool', default: true },
    isFriendsGroupActive: { type: 'bool', default: false },
    isFriendsGroupOffline: { type: 'bool', default: true },
    sidebarGroupByInstance: { type: 'bool', default: false },
    sidebarGroupByInstanceCollapsed: { type: 'bool', default: false },
    sidebarFavoriteGroups: { type: 'string', default: null },

    // ── Nav ──────────────────────────────────────────
    navIsCollapsed: { type: 'bool', default: false },
    navPanelWidth: { type: 'int', default: null },

    // ── Settings - General ───────────────────────────
    StartAtWindowsStartup: { type: 'bool', default: false },
    CloseToTray: { type: 'bool', default: false },
    autoLoginDelayEnabled: { type: 'bool', default: false },
    autoLoginDelaySeconds: { type: 'int', default: 5 },
    weekStartsOn: { type: 'int', default: null },

    // ── Settings - Appearance ────────────────────────
    ThemeMode: { type: 'string', default: null },
    lastDarkTheme: { type: 'string', default: null },
    fontFamily: { type: 'string', default: null },
    customFontFamily: { type: 'string', default: '' },
    cjkFontPack: { type: 'bool', default: false },
    dtHour12: { type: 'string', default: null },
    dtIsoFormat: { type: 'bool', default: false },
    hideNicknames: { type: 'bool', default: false },
    hideUserMemos: { type: 'bool', default: false },
    hideUserNotes: { type: 'bool', default: false },
    showPointerOnHover: { type: 'bool', default: true },
    compactTableMode: { type: 'bool', default: false },
    dataTableStriped: { type: 'bool', default: false },
    tableDensity: { type: 'string', default: null },
    tablePageSize: { type: 'int', default: null },
    useOfficialStatusColors: { type: 'bool', default: false },
    randomUserColours: { type: 'bool', default: false },

    // ── Settings - Advanced ──────────────────────────
    bioLanguage: { type: 'string', default: null },
    relaunchVRChatAfterCrash: { type: 'bool', default: false },
    vrcQuitFix: { type: 'bool', default: true },
    autoSweepVRChatCache: { type: 'bool', default: false },
    selfInviteOverride: { type: 'bool', default: false },
    saveInstancePrints: { type: 'bool', default: false },
    cropInstancePrints: { type: 'bool', default: false },
    saveInstanceStickers: { type: 'bool', default: false },
    saveInstanceEmoji: { type: 'bool', default: false },
    avatarRemoteDatabase: { type: 'bool', default: true },
    enableAppLauncher: { type: 'bool', default: true },
    enableAppLauncherAutoClose: { type: 'bool', default: true },
    screenshotHelper: { type: 'bool', default: true },
    gameLogDisabled: { type: 'bool', default: false },
    avatarAutoCleanup: { type: 'string', default: 'Off' },
    userGeneratedContentPath: { type: 'string', default: '' },
    autoDeleteOldPrints: { type: 'bool', default: false },
    progressPie: { type: 'bool', default: false },
    progressPieFilter: { type: 'bool', default: true },
    logEmptyAvatars: { type: 'bool', default: false },
    logResourceLoad: { type: 'bool', default: false },
    udonExceptionLogging: { type: 'bool', default: false },
    showNewDashboardButton: { type: 'bool', default: false },

    // ── Settings - Integrations ──────────────────────
    youtubeAPI: { type: 'bool', default: false },
    youtubeAPIKey: { type: 'string', default: '' },
    translationAPI: { type: 'bool', default: false },
    translationAPIKey: { type: 'string', default: '' },
    translationAPIType: { type: 'string', default: 'google' },
    translationAPIEndpoint: { type: 'string', default: '' },
    translationAPIModel: { type: 'string', default: '' },
    translationAPIPrompt: { type: 'string', default: '' },

    // ── Settings - Notifications ─────────────────────
    desktopToast: { type: 'bool', default: false },
    afkDesktopToast: { type: 'bool', default: false },
    imageNotifications: { type: 'bool', default: false },
    notificationTimeout: { type: 'int', default: null },
    notificationOpacity: { type: 'float', default: 100 },
    notificationLayout: { type: 'string', default: null },
    notificationTTS: { type: 'bool', default: false },
    notificationTTSVoice: { type: 'string', default: null },
    notificationTTSNickName: { type: 'bool', default: false },
    notificationIconDot: { type: 'bool', default: false },
    xsNotifications: { type: 'bool', default: false },
    chatboxBlacklist: { type: 'string', default: null },
    chatboxUserBlacklist: { type: 'string', default: null },

    // ── Settings - Overlay ───────────────────────────
    overlayWrist: { type: 'bool', default: false },
    overlayToast: { type: 'bool', default: false },
    overlayHand: { type: 'string', default: null },
    overlaybutton: { type: 'bool', default: false },
    ovrtHudNotifications: { type: 'bool', default: false },
    ovrtWristNotifications: { type: 'bool', default: false },

    // ── Settings - VR Background ─────────────────────
    vrBackgroundEnabled: { type: 'bool', default: false },
    vrOverlayCpuUsage: { type: 'bool', default: false },

    // ── Photon ───────────────────────────────────────
    PhotonEventOverlay: { type: 'bool', default: false },
    TimeoutHudOverlay: { type: 'bool', default: false },
    photonLoggingEnabled: { type: 'bool', default: false },
    photonEventTypeFilter: { type: 'string', default: null },
    photonLobbyTimeoutThreshold: { type: 'int', default: null },

    // ── Auto State Change ────────────────────────────
    autoStateChangeEnabled: { type: 'bool', default: false },
    autoStateChangeAloneDesc: { type: 'string', default: null },
    autoStateChangeCompanyDesc: { type: 'string', default: null },
    autoStateChangeNoFriends: { type: 'bool', default: false },
    autoStateChangeGroups: { type: 'string', default: null },
    autoAcceptInviteRequests: { type: 'bool', default: false },
    autoAcceptInviteGroups: { type: 'string', default: null },

    // ── Registry Backup ──────────────────────────────
    vrcRegistryAutoBackup: { type: 'bool', default: false },
    vrcRegistryAskRestore: { type: 'bool', default: false },
    VRChatRegistryBackups: { type: 'string', default: null },
    VRChatRegistryLastBackupDate: { type: 'string', default: null },
    VRChatRegistryLastRestoreCheck: { type: 'string', default: null },

    // ── Feed ─────────────────────────────────────────
    feedTableFilters: { type: 'string', default: '[]' },
    hidePrivateFromFeed: { type: 'bool', default: false },
    hideDevicesFromFeed: { type: 'bool', default: false },
    hideUptimeFromFeed: { type: 'bool', default: false },
    hideUnfriends: { type: 'bool', default: false },
    pcUptimeOnFeed: { type: 'bool', default: false },
    minimalFeed: { type: 'bool', default: false },
    recentActionCooldownEnabled: { type: 'bool', default: false },
    recentActionCooldownMinutes: { type: 'int', default: null },
    sortFavorites: { type: 'bool', default: false },

    // ── Table Filters ────────────────────────────────
    notificationTableFilters: { type: 'string', default: '[]' },
    playerModerationTableFilters: { type: 'string', default: '[]' },
    friendLogTableFilters: { type: 'string', default: '[]' },
    gameLogTableFilters: { type: 'string', default: '[]' },
    gameLogTableVIPFilter: { type: 'bool', default: false },
    gameLogViewMode: { type: 'string', default: null },

    // ── View State ───────────────────────────────────
    MyAvatarsViewMode: { type: 'string', default: 'grid' },
    MyAvatarsCardScale: { type: 'string', default: null },
    MyAvatarsCardSpacing: { type: 'string', default: null },
    FriendLocationCardScale: { type: 'string', default: '1' },
    FriendLocationCardSpacing: { type: 'string', default: '1' },
    FriendLocationShowSameInstance: { type: 'bool', default: null },
    InstanceActivityBarWidth: { type: 'int', default: 25 },
    groupCalendarShowFeaturedEvents: { type: 'bool', default: false },
    toolsCategoryCollapsed: { type: 'string', default: null },

    // ── Charts ───────────────────────────────────────
    MutualGraphLayoutIterations: { type: 'int', default: null },
    MutualGraphLayoutSpacing: { type: 'int', default: null },
    MutualGraphEdgeCurvature: { type: 'float', default: null },
    MutualGraphCommunitySeparation: { type: 'float', default: null },

    // ── Activity ─────────────────────────────────────
    activitySelfPeriodDays: { type: 'string', default: null },
    activityFriendPeriodDays: { type: 'string', default: null },
    activitySelfTopWorldsSortBy: { type: 'string', default: null },
    activitySelfExcludeHomeWorld: { type: 'bool', default: false },
    overlapExcludeEnabled: { type: 'bool', default: false },
    overlapExcludeStart: { type: 'string', default: '1' },
    overlapExcludeEnd: { type: 'string', default: '6' },

    // ── Status Bar ───────────────────────────────────
    statusBarVisibility: { type: 'string', default: null },
    statusBarClocks: { type: 'string', default: null },
    statusBarClockCount: { type: 'string', default: null },

    // ── Game State ───────────────────────────────────
    lastGameOfflineAt: { type: 'string', default: null },
    lastGameSessionMs: { type: 'string', default: null },

    // ── Dashboard ────────────────────────────────────
    localFavoriteFriendsGroups: { type: 'string', default: null },

    // ── Onboarding ───────────────────────────────────
    onboarding_welcome_seen: { type: 'bool', default: false },

    // ── Avatar Provider ──────────────────────────────
    showConfirmationOnSwitchAvatar: { type: 'bool', default: true }
};

/** DB key prefix */
export const DB_KEY_PREFIX = 'config:vrcx-0_';

/** Legacy DB key prefix (auto-migrated on first read) */
export const LEGACY_DB_KEY_PREFIX = 'config:vrcx_';

/**
 * Schema name → DB key
 * e.g. "appLanguage" → "config:vrcx-0_applanguage"
 */
export function toDbKey(name) {
    return `${DB_KEY_PREFIX}${name.toLowerCase()}`;
}

/**
 * Schema name → legacy DB key (without -0)
 * e.g. "appLanguage" → "config:vrcx_applanguage"
 */
export function toLegacyDbKey(name) {
    return `${LEGACY_DB_KEY_PREFIX}${name.toLowerCase()}`;
}
