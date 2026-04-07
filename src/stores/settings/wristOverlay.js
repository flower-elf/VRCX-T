import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useSharedFeedStore } from '../sharedFeed';

import configRepository from '../../services/config';

export const useWristOverlaySettingsStore = defineStore(
    'WristOverlaySettings',
    () => {
        const sharedFeed = useSharedFeedStore();

        const overlayWrist = ref(true);
        const hidePrivateFromFeed = ref(false);
        const openVRAlways = ref(false);
        const overlaybutton = ref(false);
        const overlayHand = ref('0');
        const vrBackgroundEnabled = ref(false);
        const minimalFeed = ref(true);
        const hideDevicesFromFeed = ref(false);
        const vrOverlayCpuUsage = ref(false);
        const hideUptimeFromFeed = ref(false);
        const pcUptimeOnFeed = ref(false);

        async function initWristOverlaySettings() {
            const [
                overlayWristConfig,
                hidePrivateFromFeedConfig,
                openVRAlwaysConfig,
                overlaybuttonConfig,
                overlayHandConfig,
                vrBackgroundEnabledConfig,
                minimalFeedConfig,
                hideDevicesFromFeedConfig,
                vrOverlayCpuUsageConfig,
                hideUptimeFromFeedConfig,
                pcUptimeOnFeedConfig
            ] = await Promise.all([
                configRepository.getBool('overlayWrist', false),
                configRepository.getBool('hidePrivateFromFeed', false),
                configRepository.getBool('openVRAlways', false),
                configRepository.getBool('overlaybutton', false),
                configRepository.getInt('overlayHand', 0),
                configRepository.getBool('vrBackgroundEnabled', false),
                configRepository.getBool('minimalFeed', true),
                configRepository.getBool('hideDevicesFromFeed', false),
                configRepository.getBool('vrOverlayCpuUsage', false),
                configRepository.getBool('hideUptimeFromFeed', false),
                configRepository.getBool('pcUptimeOnFeed', false)
            ]);

            overlayWrist.value = overlayWristConfig;
            hidePrivateFromFeed.value = hidePrivateFromFeedConfig;
            openVRAlways.value = openVRAlwaysConfig;
            overlaybutton.value = overlaybuttonConfig;
            overlayHand.value = String(overlayHandConfig);
            vrBackgroundEnabled.value = vrBackgroundEnabledConfig;
            minimalFeed.value = minimalFeedConfig;
            hideDevicesFromFeed.value = hideDevicesFromFeedConfig;
            vrOverlayCpuUsage.value = vrOverlayCpuUsageConfig;
            hideUptimeFromFeed.value = hideUptimeFromFeedConfig;
            pcUptimeOnFeed.value = pcUptimeOnFeedConfig;
        }

        function setOverlayWrist() {
            overlayWrist.value = !overlayWrist.value;
            configRepository.setBool('overlayWrist', overlayWrist.value);
        }
        function setHidePrivateFromFeed() {
            hidePrivateFromFeed.value = !hidePrivateFromFeed.value;
            configRepository.setBool(
                'VRCX_hidePrivateFromFeed',
                hidePrivateFromFeed.value
            );
            sharedFeed.loadSharedFeed();
        }
        function setOpenVRAlways() {
            openVRAlways.value = !openVRAlways.value;
            configRepository.setBool('openVRAlways', openVRAlways.value);
        }
        function setOverlaybutton() {
            overlaybutton.value = !overlaybutton.value;
            configRepository.setBool('overlaybutton', overlaybutton.value);
        }
        /**
         * @param {string} value
         */
        function setOverlayHand(value) {
            overlayHand.value = value;
            let overlayHandInt = parseInt(value, 10);
            if (isNaN(overlayHandInt)) {
                overlayHandInt = 0;
            }
            configRepository.setInt('overlayHand', overlayHandInt);
        }
        function setVrBackgroundEnabled() {
            vrBackgroundEnabled.value = !vrBackgroundEnabled.value;
            configRepository.setBool(
                'VRCX_vrBackgroundEnabled',
                vrBackgroundEnabled.value
            );
        }
        function setMinimalFeed() {
            minimalFeed.value = !minimalFeed.value;
            configRepository.setBool('minimalFeed', minimalFeed.value);
        }
        function setHideDevicesFromFeed() {
            hideDevicesFromFeed.value = !hideDevicesFromFeed.value;
            configRepository.setBool(
                'VRCX_hideDevicesFromFeed',
                hideDevicesFromFeed.value
            );
        }
        function setVrOverlayCpuUsage() {
            vrOverlayCpuUsage.value = !vrOverlayCpuUsage.value;
            configRepository.setBool(
                'VRCX_vrOverlayCpuUsage',
                vrOverlayCpuUsage.value
            );
        }
        function setHideUptimeFromFeed() {
            hideUptimeFromFeed.value = !hideUptimeFromFeed.value;
            configRepository.setBool(
                'VRCX_hideUptimeFromFeed',
                hideUptimeFromFeed.value
            );
        }
        function setPcUptimeOnFeed() {
            pcUptimeOnFeed.value = !pcUptimeOnFeed.value;
            configRepository.setBool(
                'VRCX_pcUptimeOnFeed',
                pcUptimeOnFeed.value
            );
        }

        initWristOverlaySettings();

        return {
            overlayWrist,
            hidePrivateFromFeed,
            openVRAlways,
            overlaybutton,
            overlayHand,
            vrBackgroundEnabled,
            minimalFeed,
            hideDevicesFromFeed,
            vrOverlayCpuUsage,
            hideUptimeFromFeed,
            pcUptimeOnFeed,

            setOverlayWrist,
            setHidePrivateFromFeed,
            setOpenVRAlways,
            setOverlaybutton,
            setOverlayHand,
            setVrBackgroundEnabled,
            setMinimalFeed,
            setHideDevicesFromFeed,
            setVrOverlayCpuUsage,
            setHideUptimeFromFeed,
            setPcUptimeOnFeed
        };
    }
);
