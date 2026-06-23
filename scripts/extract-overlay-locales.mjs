import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const overlayOutputPath = path.join(
    repoRoot,
    'crates',
    'runtime-host',
    'src',
    'vr_overlay',
    'localization',
    'overlay_notifications.json'
);
const shellOutputPath = path.join(
    repoRoot,
    'src-tauri',
    'src',
    'localization',
    'shell_strings.json'
);

const overlayLocales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];
const shellLocales = [
    'cs',
    'en',
    'es',
    'fr',
    'hu',
    'ja',
    'ko',
    'pl',
    'pt',
    'ru',
    'th',
    'vi',
    'zh-CN',
    'zh-TW'
];
const keys = [
    'has_joined',
    'has_left',
    'is_joining',
    'gps',
    'online',
    'online_location',
    'offline',
    'status_update',
    'avatar_change',
    'friend',
    'unfriend',
    'display_name',
    'trust_level',
    'invite',
    'request_invite',
    'invite_response',
    'request_invite_response',
    'friend_request',
    'group_announcement_title',
    'group_informative_title',
    'group_invite_title',
    'group_join_request_title',
    'group_transfer_request_title',
    'group_queue_ready_title',
    'instance_closed_title',
    'blocked',
    'unblocked',
    'muted',
    'unmuted',
    'blocked_player_joined',
    'blocked_player_left',
    'muted_player_joined',
    'muted_player_left'
];
const pathKeys = [
    ['overlay.footer.players', ['overlay', 'footer', 'players']],
    [
        'overlay.footer.instance_duration',
        ['overlay', 'footer', 'instance_duration']
    ],
    ['overlay.access.public', ['dialog', 'new_instance', 'access_type_public']],
    ['overlay.access.invite', ['dialog', 'new_instance', 'access_type_invite']],
    [
        'overlay.access.invite_plus',
        ['dialog', 'new_instance', 'access_type_invite_plus']
    ],
    [
        'overlay.access.friends',
        ['dialog', 'new_instance', 'access_type_friend']
    ],
    [
        'overlay.access.friends_plus',
        ['dialog', 'new_instance', 'access_type_friend_plus']
    ],
    ['overlay.access.group', ['dialog', 'new_instance', 'access_type_group']],
    [
        'overlay.access.group_public',
        ['dialog', 'new_instance', 'group_access_type_public']
    ],
    [
        'overlay.access.group_plus',
        ['dialog', 'new_instance', 'group_access_type_plus']
    ],
    ['overlay.status.active', ['dialog', 'user', 'status', 'online']],
    ['overlay.status.join_me', ['dialog', 'user', 'status', 'join_me']],
    ['overlay.status.ask_me', ['dialog', 'user', 'status', 'ask_me']],
    ['overlay.status.busy', ['dialog', 'user', 'status', 'busy']]
];
const shellPathKeys = [
    ['nativeShell.tray.open', ['nativeShell', 'tray', 'open']],
    [
        'nativeShell.tray.backgroundMode',
        ['nativeShell', 'tray', 'backgroundMode']
    ],
    ['nativeShell.tray.rebuildUi', ['nativeShell', 'tray', 'rebuildUi']],
    ['nativeShell.tray.disableTheme', ['nativeShell', 'tray', 'disableTheme']],
    ['nativeShell.tray.exit', ['nativeShell', 'tray', 'exit']],
    [
        'nativeShell.notification.backgroundModeStarted.title',
        ['nativeShell', 'notification', 'backgroundModeStarted', 'title']
    ],
    [
        'nativeShell.notification.backgroundModeStarted.body',
        ['nativeShell', 'notification', 'backgroundModeStarted', 'body']
    ],
    [
        'nativeShell.notification.authFailure.title',
        ['nativeShell', 'notification', 'authFailure', 'title']
    ],
    [
        'nativeShell.notification.authFailure.body',
        ['nativeShell', 'notification', 'authFailure', 'body']
    ]
];

const overlayCatalog = createCatalog();

for (const locale of overlayLocales) {
    const inputPath = path.join(
        repoRoot,
        'src',
        'localization',
        `${locale}.json`
    );
    const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const notifications = source.notifications || {};
    const entries = {};

    for (const key of keys) {
        const value = notifications[key];
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing notifications.${key}`);
        }
        entries[`notifications.${key}`] = value;
    }
    for (const [outputKey, sourcePath] of pathKeys) {
        const value = readPath(source, sourcePath);
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing ${outputKey}`);
        }
        entries[outputKey] = value;
    }

    overlayCatalog.locales[locale] = entries;
}

writeCatalog(overlayOutputPath, overlayCatalog);

const shellCatalog = createCatalog();

for (const locale of shellLocales) {
    const inputPath = path.join(
        repoRoot,
        'src',
        'localization',
        `${locale}.json`
    );
    const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const entries = {};

    for (const [outputKey, sourcePath] of shellPathKeys) {
        const value = readPath(source, sourcePath);
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing ${outputKey}`);
        }
        entries[outputKey] = value;
    }

    shellCatalog.locales[locale] = entries;
}

writeCatalog(shellOutputPath, shellCatalog);

function readPath(source, sourcePath) {
    return sourcePath.reduce((value, key) => {
        if (value && typeof value === 'object') {
            return value[key];
        }
        return undefined;
    }, source);
}

function createCatalog() {
    return {
        version: 1,
        fallbackLocale: 'en',
        locales: {}
    };
}

function writeCatalog(outputPath, catalog) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 4)}\n`);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
