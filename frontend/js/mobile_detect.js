/**
 * Mobile Device Detection Utility
 * Provides a shared function to detect mobile/touch devices.
 * Must be loaded before effect scripts that depend on it.
 */
(function () {
    window.isMobileDevice = function () {
        // Check for mobile user agents
        const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check for touch capability with multiple touch points
        const hasTouchScreen = ('ontouchstart' in window) && navigator.maxTouchPoints > 0;

        // Android Chrome sometimes has both mouse and touch - prioritize UA check
        return mobileUA || hasTouchScreen;
    };

    // Precise Platform Detection
    window.isAndroid = function () {
        return /Android/i.test(navigator.userAgent);
    };

    window.isIOS = function () {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad Pro
    };

    // Cache the result for performance (device type doesn't change during session)
    window._isMobileDeviceCached = null;
    const originalFn = window.isMobileDevice;
    window.isMobileDevice = function () {
        if (window._isMobileDeviceCached === null) {
            window._isMobileDeviceCached = originalFn();
        }
        return window._isMobileDeviceCached;
    };
})();
