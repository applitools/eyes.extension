/**
 * Provides an api for manipulating browser windows and tabs.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp');

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
                ChromeUtils.sleep(stabilizationTimeMs).then(function () {
                    deferred.resolve(results);
                });
                return;
            }
            deferred.resolve(results);
        });
        return deferred.promise;
    };

    /**
     * Waits a specified amount of time before resolving the returned promise.
     * @param {int} ms The amount of time to sleep in milliseconds.
     * @return {Promise} A promise which is resolved when sleep is done.
     */
    ChromeUtils.sleep = function (ms) {
        var deferred = RSVP.defer();
        setTimeout(function () {
            deferred.resolve();
        }, ms);
        return deferred.promise;
    };

    module.exports = ChromeUtils;
}());