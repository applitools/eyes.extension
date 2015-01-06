/**
 * Provides an api for manipulating browser windows and tabs.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp'),
        JSUtils = require('./../JSUtils.js');

    var ChromeUtils = {};

    /**
     * Executes a script on the given tab.
     * @param {int} tabId The tab on which to execute the script.
     * @param {string} code The code to execute on the given tab.
     * @param {number|undefined} stabilizationTimeMs (optional) The amount of time to wait after script execution to
     *                                                  let the browser a chance to stabilize (e.g., finish rendering).
     * @return {Promise} A promise which resolves to the result of the script's execution on the tab.
     */
    ChromeUtils.executeScript = function (tabId, code, stabilizationTimeMs) {
        var deferred = RSVP.defer();
        chrome.tabs.executeScript(tabId, {code: code}, function (results) {
            if (stabilizationTimeMs) {
                JSUtils.sleep(stabilizationTimeMs).then(function () {
                    deferred.resolve(results);
                });
                return;
            }
            deferred.resolve(results);
        });
        return deferred.promise;
    };

    /**
     *
     * @return {Promise} A promise which resolves to the current tab opened in front of the user.
     */
    ChromeUtils.getCurrentTab = function () {
        var deferred = RSVP.defer();
        chrome.tabs.query({currentWindow: true, active: true}, function (tabsList) {
            // Since there's only one active tab in the current window,
            deferred.resolve(tabsList[0]);
        });
        return deferred.promise;
    };

    /**
     * Opens a new tab.
     * @param {string|undefined} url The URL which the new tab should load.
     * @param {number|undefined} windowId The ID of the window in which the tab should be opened. If {@code undefined} the
     *                          current window will be used.
     * @param {boolean|undefined} isActive Whether or not the new tab should be the active tab in the window.
     * @return {Promise} A promise which resolves to the new tab.
     */
    ChromeUtils.createTab = function (url, windowId, isActive) {
        isActive = isActive || false;

        var deferred = RSVP.defer();

        // If the user closed the tab
        chrome.tabs.create({
            windowId: windowId,
            url: url,
            active: isActive
        }, function (tab) {
            if (!tab) {
                deferred.reject("Failed to create tab!");
                return;
            }
            deferred.resolve(tab);
        });

        return deferred.promise;
    };

    /**
     * Updates an existing tab.
     * @param {number} tabId The ID of the tab to update.
     * @param {string} url The url which the tab should load.
     * @return {Promise} A promise which resolves when the tab is updated, or rejects on failure.
     */
    ChromeUtils.loadUrl = function (tabId, url) {
        var deferred = RSVP.defer();

        chrome.tabs.update(tabId, {url: url}, function (tab) {
            if (!tab) {
                deferred.reject("Failed to update tab! Tab ID: " + tabId);
                return;
            }
            deferred.resolve(tab);
        });

        return deferred.promise;
    };

    /**
     * Makes the given tab the active tab.
     * @param {number} tabId The ID of the tab to switch to.
     * @return {Promise} A promise which resolves to the tab after it is switched to.
     */
    ChromeUtils.switchToTab = function (tabId) {
        var deferred = RSVP.defer();

        chrome.tabs.update(tabId, {active: true}, function (tab) {
            if (!tab) {
                deferred.reject("Failed to make tab active! Tab ID: " + tabId);
                return;
            }
            deferred.resolve(tab);
        });

        return deferred.promise;
    };

    /**
     * Closes one or more tabs.
     * @param {number|Array} tabIds An integer or array of integers, which are the ID/s of the tab to close.
     * @return {Promise} A promise which resolves once the tab is closed.
     */
    ChromeUtils.removeTab = function (tabIds) {
        var deferred = RSVP.defer();

        chrome.tabs.remove(tabIds, function () {
            deferred.resolve();
        });

        return deferred.promise;
    };

    module.exports = ChromeUtils;
}());