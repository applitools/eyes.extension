/**
 * Provides a gateway for getting/setting the extension's configuration.
 */
(function () {
    "use strict";

    // FIXME Daniel - Change storage adapter reference to general reference.
    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp'),
        StorageAdapter = require('./dist-chrome/StorageAdapter.js');

    // Lookup keys for the storage
    var _MATCH_LEVEL_LK = 'matchLevel';
    var _VIEWPORT_SIZE_LK = 'viewportSize';
    var _BASELINE_APP_NAME_LK = 'baselineAppName';
    var _BASELINE_TEST_NAME_LK = 'baselineTestName';
    var _BASELINE_STEP_URL_LK = 'baselineStepUrl';
    var _BASELINE_SELECTION_ID_LK = 'baselineSelectionId';
    var _NEW_TAB_FOR_RESULTS_LK = 'newTabForResults';
    var _TAKE_FULL_PAGE_SCREENSHOT_LK = 'takeFullPageScreenshot';
    var _EYES_SERVER_URL_LK = 'eyesServer';

    var _API_KEY_COOKIE_URL = 'https://applitools.com';
    var _API_KEY_COOKIE_NAME = 'account-id';

    var ConfigurationStore = {};

    /**
     * The extent in which two images match (or are expected to match).
     * @type {string[]}
     * @private
     */
    var _matchLevels = ['Layout', 'Content', 'Strict', 'Exact'];

    var _DEFAULT_MATCH_LEVEL = 'Strict';

    var _DEFAULT_EYES_SERVER_URL = 'https://eyessdk.applitools.com';

    /**
     * Available viewport sizes for performing a match.
     * @type {string[]}
     * @private
     */
    var _viewportSizes  = ['320x480', '320x533', '320x568', '360x640', '600x1024', '768x1024', '800x600', '900x650',
                            '1024x600', '1180x700', '1260x660', '1800x950'];
    var _DEFAULT_VIEWPORT_SIZE = '800x600';

    var _DEFAULT_NEW_TAB_FOR_RESULTS = true;
    var _DEFAULT_TAKE_FULL_PAGE_SCREENSHOT = true;

    /**
     * Sets a value for the given key in the storage, or removes the currently set value if the given value is
     * undefined.
     * @param key
     * @param val
     * @return {Promise} A promise which resolves to {key: value} if set is activated, or to key if values was removed.
     * @private
     */
    ConfigurationStore._setOrRemoveUndefined = function (key, val) {
        if (val === undefined) {
            return StorageAdapter.removeItem(key);
        }
        return StorageAdapter.setItem(key, val);
    };

    /**
     * @return {Promise} A promise which resolves the list of valid match levels.
     */
    ConfigurationStore.getAllMatchLevels = function () {
        return RSVP.resolve(_matchLevels.slice());
    };

    /**
     * @return {Promise} A promise which resolves the list of valid viewport sizes.
     */
    ConfigurationStore.getAllViewportSizes = function () {
        return RSVP.resolve(_viewportSizes.slice());
    };

    /**
     * @return {Promise} A promise which resolves to the saved match level, or the predefined default
     * if there's no such value in the storage.
     */
    ConfigurationStore.getMatchLevel = function () {
        return StorageAdapter.getItem(_MATCH_LEVEL_LK, _DEFAULT_MATCH_LEVEL);
    };

    /**
     * @param matchLevel The match level to save. {undefined}/invalid value will cause the predefined default to be set.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setMatchLevel = function (matchLevel) {
        if (!matchLevel || _matchLevels.indexOf(matchLevel) === -1) {
            matchLevel = _DEFAULT_MATCH_LEVEL;
        }
        return StorageAdapter.setItem(_MATCH_LEVEL_LK, matchLevel);
    };

    /**
     * @return {Promise} A promise which resolves to the saved viewport size, or the predefined default
     * if there's no such value in the storage.
     */
    ConfigurationStore.getViewportSize = function () {
        return StorageAdapter.getItem(_VIEWPORT_SIZE_LK, _DEFAULT_VIEWPORT_SIZE);
    };

    /**
     * @param viewportSize The viewport size to save. Undefined/invalid value will cause the predefined default to be
     *                      set.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setViewportSize = function (viewportSize) {
        if (!viewportSize || _viewportSizes.indexOf(viewportSize) === -1) {
            viewportSize = _DEFAULT_VIEWPORT_SIZE;
        }
        return StorageAdapter.setItem(_VIEWPORT_SIZE_LK, viewportSize);
    };

    /**
     * @return {Promise} A promise which resolves to the saved step url, or undefined if there's no such value in the
     * storage.
     */
    ConfigurationStore.getBaselineStepUrl = function () {
        return StorageAdapter.getItem(_BASELINE_STEP_URL_LK, undefined);
    };

    /**
     * @param {string} stepUrl The step URL to save, or undefined to clear the currently saved value.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setBaselineStepUrl = function (stepUrl) {
        return this._setOrRemoveUndefined(_BASELINE_STEP_URL_LK, stepUrl);
    };

    /**
     * @return {Promise} A promise which resolves to the application name, or undefined if there's no such value in the
     * storage.
     */
    ConfigurationStore.getBaselineAppName = function () {
        return StorageAdapter.getItem(_BASELINE_APP_NAME_LK, undefined);
    };

    /**
     * @param {string} appName The name to save, or undefined.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setBaselineAppName = function (appName) {
        return this._setOrRemoveUndefined(_BASELINE_APP_NAME_LK, appName);
    };

    /**
     * @return {Promise} A promise which resolves to the saved test name, or undefined if there's no such value in the
     * storage.
     */
    ConfigurationStore.getBaselineTestName = function () {
        return StorageAdapter.getItem(_BASELINE_TEST_NAME_LK, undefined);
    };

    /**
     * @param {string} testName The name to save, or undefined.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setBaselineTestName = function (testName) {
        return this._setOrRemoveUndefined(_BASELINE_TEST_NAME_LK, testName);
    };

    /**
     * @return {Promise} A promise which resolves to the saved baseline selection (user values / step url),
     * or undefined if there's no such value in the storage.
     */
    ConfigurationStore.getBaselineSelection = function () {
        return StorageAdapter.getItem(_BASELINE_SELECTION_ID_LK, undefined);
    };

    /**
     * @param {string} selectionId The id of the selection element, or undefined.
     * @return {Promise} A promise which resolves when the value is saved, or rejects on failure.
     */
    ConfigurationStore.setBaselineSelection = function (selectionId) {
        return this._setOrRemoveUndefined(_BASELINE_SELECTION_ID_LK, selectionId);
    };

    /**
     * @return {Promise} A promise which resolves to the saved choice for new tab for results, or the predefined default
     * if there's no such value in the storage.
     */
    ConfigurationStore.getNewTabForResults = function () {
        return StorageAdapter.getItem(_NEW_TAB_FOR_RESULTS_LK, _DEFAULT_NEW_TAB_FOR_RESULTS);
    };

    /**
     * @param {boolean} shouldOpen The choice to save. Undefined/invalid value will cause the predefined default to be
     *                              set.
     * @return {Promise} A promise which resolves when the value is saved, or rejects otherwise.
     */
    ConfigurationStore.setNewTabForResults = function (shouldOpen) {
        if (shouldOpen === undefined) {
            shouldOpen = _DEFAULT_NEW_TAB_FOR_RESULTS;
        }
        return StorageAdapter.setItem(_NEW_TAB_FOR_RESULTS_LK, shouldOpen);
    };

    /**
     * @return {Promise} A promise which resolves to the saved choice for takeFullPageScreenshot checkbox,
     * or the predefined default if there's no such value in the storage.
     */
    ConfigurationStore.getTakeFullPageScreenshot = function () {
        return StorageAdapter.getItem(_TAKE_FULL_PAGE_SCREENSHOT_LK, _DEFAULT_TAKE_FULL_PAGE_SCREENSHOT);
    };

    /**
     * @param {boolean} shouldTake The choice to save. Undefined/invalid value will cause the predefined default to be
     *                              set.
     * @return {Promise} A promise which resolves when the value is saved, or rejects otherwise.
     */
    ConfigurationStore.setTakeFullPageScreenshot = function (shouldTake) {
        if (shouldTake === undefined) {
            shouldTake = _DEFAULT_TAKE_FULL_PAGE_SCREENSHOT;
        }
        return StorageAdapter.setItem(_TAKE_FULL_PAGE_SCREENSHOT_LK, shouldTake);
    };

    /**
     * @return {Promise} A promise which resolves to the saved eyes server, or the predefined default
     * if there's no such value in the storage.
     */
    ConfigurationStore.getEyesServerUrl = function () {
        return StorageAdapter.getItem(_EYES_SERVER_URL_LK, _DEFAULT_EYES_SERVER_URL);
    };

    /**
     * @param {string|undefined} eyesServerUrl The value to save. Undefined value will cause the predefined default to
     *                                          be set.
     * @return {Promise} A promise which resolves when the value is saved, or rejects otherwise.
     */
    ConfigurationStore.setEyesServerUrl = function (eyesServerUrl) {
        if (eyesServerUrl === undefined || !eyesServerUrl.trim()) {
            eyesServerUrl = _DEFAULT_EYES_SERVER_URL;
        }
        return StorageAdapter.setItem(_EYES_SERVER_URL_LK, eyesServerUrl);
    };

    /**
     * @return {Promise} A promise which resolves to the saved API key, or the the API key available via applitools
     * cookie, or undefined.
     */
    ConfigurationStore.getApiKey = function () {
        return StorageAdapter.getCookie(_API_KEY_COOKIE_URL, _API_KEY_COOKIE_NAME).then(function (cookie) {
            return cookie ? cookie.value : undefined;
        });
    };

    //noinspection JSUnresolvedVariable
    module.exports = ConfigurationStore;
}());