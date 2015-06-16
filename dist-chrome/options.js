/**
 * Handling get/set of the extension's options.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var ConfigurationStore = require('./../ConfigurationStore.js'),
        RSVP = require('rsvp');

    var Applitools = chrome.extension.getBackgroundPage().Applitools;

    /**
     * Sets whether or not a new tab should be opened for showing results on test end.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveNewTabForResults = function () {
        var shouldOpen = document.getElementById('newTabForResults').checked;
        return ConfigurationStore.setNewTabForResults(shouldOpen);
    };

    /**
     * Loads the saved value to the options' page newTabForResults checkbox.
     * @return {Promise} A promise which resolves to the element when the checkbox is set.
     * @private
     */
    var _restoreNewTabForResults = function () {
        var newTabForResultsElement = document.getElementById('newTabForResults');
        return ConfigurationStore.getNewTabForResults().then(function (shouldOpen) {
            newTabForResultsElement.checked = shouldOpen;
            return RSVP.resolve(newTabForResultsElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initNewTabForResults = function () {
        return _restoreNewTabForResults().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveNewTabForResults);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets whether or not a full page screenshot should be taken when checking a window.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveTakeFullPageScreenshot = function () {
        var shouldTake = document.getElementById('takeFullPageScreenshot').checked;
        return ConfigurationStore.setTakeFullPageScreenshot(shouldTake);
    };

    /**
     * Loads the saved value to the options' page takeFullPageScreenshot checkbox.
     * @return {Promise} A promise which resolves to the element when the checkbox is set.
     * @private
     */
    var _restoreTakeFullPageScreenshot = function () {
        var takeFullPageScreenshotElement = document.getElementById('takeFullPageScreenshot');
        return ConfigurationStore.getTakeFullPageScreenshot().then(function (shouldTake) {
            takeFullPageScreenshotElement.checked = shouldTake;
            return RSVP.resolve(takeFullPageScreenshotElement);
        });
    };

    /**
     * Loads the required value and sets the required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initTakeFullPageScreenshot = function () {
        return _restoreTakeFullPageScreenshot().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveTakeFullPageScreenshot);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets whether or not we should hide the scrollbars before taking a screenshot.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveRemoveScrollBars = function () {
        var shouldRemove = document.getElementById('removeScrollBars').checked;
        return ConfigurationStore.setRemoveScrollBars(shouldRemove);
    };

    /**
     * Loads the saved value to the checkbox.
     * @return {Promise} A promise which resolves to the element when the checkbox is set.
     * @private
     */
    var _restoreRemoveScrollBars = function () {
        var removeScrollBarsElement = document.getElementById('removeScrollBars');
        return ConfigurationStore.getRemoveScrollBars().then(function (shouldRemove) {
            removeScrollBarsElement.checked = shouldRemove;
            return RSVP.resolve(removeScrollBarsElement);
        });
    };

    /**
     * Loads the required value and sets the required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initRemoveScrollBars = function () {
        return _restoreRemoveScrollBars().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveRemoveScrollBars);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets the Eyes server URL.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveEyesServerUrl = function () {
        var eyesServerUrl = document.getElementById('eyesServerUrl').value;
        return ConfigurationStore.setEyesServerUrl(eyesServerUrl);
    };

    /**
     * Loads the saved value to the input element.
     * @return {Promise} A promise which resolves to the element when the text input is set.
     * @private
     */
    var _restoreEyesServer = function () {
        var eyesServerUrlElement = document.getElementById('eyesServerUrl');
        return ConfigurationStore.getEyesServerUrl().then(function (eyesServerUrl) {
            eyesServerUrlElement.value = eyesServerUrl;
            return RSVP.resolve(eyesServerUrlElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initEyesServerUrl = function () {
        return _restoreEyesServer().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveEyesServerUrl);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets the required listeners on the restoreDefaultUrl button.
     * @return {Promise} A promise which resolves when finished setting the listener.
     * @private
     */
    var _initRestoreDefaultUrlButton = function () {
        var restoreDefaultUrlButton = document.getElementById('restoreDefaultUrl');
        restoreDefaultUrlButton.addEventListener('click', function () {
            return ConfigurationStore.setEyesServerUrl(undefined).then(function () {
                return _restoreEyesServer();
            });
        });
        return RSVP.resolve();
    };

    /**
     * Sets the Eyes API server URL.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveEyesApiServerUrl = function () {
        var eyesApiServerUrl = document.getElementById('eyesApiServerUrl').value;
        return ConfigurationStore.setEyesApiServerUrl(eyesApiServerUrl);
    };

    /**
     * Loads the saved value to the input element.
     * @return {Promise} A promise which resolves to the element when the text input is set.
     * @private
     */
    var _restoreEyesApiServer = function () {
        var eyesApiServerUrlElement = document.getElementById('eyesApiServerUrl');
        return ConfigurationStore.getEyesApiServerUrl().then(function (eyesApiServerUrl) {
            eyesApiServerUrlElement.value = eyesApiServerUrl;
            return RSVP.resolve(eyesApiServerUrlElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initEyesApiServerUrl = function () {
        return _restoreEyesApiServer().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveEyesApiServerUrl);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets the required listeners on the restoreDefaultUrl button.
     * @return {Promise} A promise which resolves when finished setting the listener.
     * @private
     */
    var _initRestoreDefaultApiUrlButton = function () {
        var restoreDefaultApiUrlButton = document.getElementById('restoreDefaultApiUrl');
        restoreDefaultApiUrlButton.addEventListener('click', function () {
            return ConfigurationStore.setEyesApiServerUrl(undefined).then(function () {
                return _restoreEyesApiServer();
            });
        });
        return RSVP.resolve();
    };

    /**
     * Saves the page part wait time.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _savePagePartWaitTime = function () {
        var pagePartWaitTime = document.getElementById('pagePartWaitTime').value;
        pagePartWaitTime = (pagePartWaitTime && pagePartWaitTime.trim()) ? parseInt(pagePartWaitTime, 10) : undefined;
        return ConfigurationStore.setPagePartWaitTime(pagePartWaitTime);
    };

    /**
     * Loads the saved value to the input element.
     * @return {Promise} A promise which resolves to the element when the text input is set.
     * @private
     */
    var _restorePagePartWaitTime = function () {
        var pagePartWaitTimeElement = document.getElementById('pagePartWaitTime');
        return ConfigurationStore.getPagePartWaitTime().then(function (pagePartWaitTime) {
            pagePartWaitTimeElement.value = pagePartWaitTime.toString();
            return RSVP.resolve(pagePartWaitTimeElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initPagePartWaitTime = function () {
        return _restorePagePartWaitTime().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _savePagePartWaitTime);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets the required listeners on the restoreDefaultUrl button.
     * @return {Promise} A promise which resolves when finished setting the listener.
     * @private
     */
    var _initRestoreDefaultPagePartWaitTimeButton = function () {
        var restoreDefaultPagePartWaitTimeButton = document.getElementById('restoreDefaultPagePartWaitTime');
        restoreDefaultPagePartWaitTimeButton.addEventListener('click', function () {
            return ConfigurationStore.setPagePartWaitTime(undefined).then(function () {
                return _restorePagePartWaitTime();
            });
        });
        return RSVP.resolve();
    };

    /**
     * Loads logs into the logs section.
     * @return {Promise} A promise which resolves when the logs are loaded.
     * @private
     */
    var _restoreLogs = function () {
        var logsElement = document.getElementById("runLogs");
        var logs = Applitools.currentState.logs;
        //noinspection JSLint
        for (var i=0; i<logs.length; ++i) {
            var currentLog = logs[i];
            logsElement.value += currentLog.timestamp + "\t" + currentLog.message + "\r\n";
        }
        return RSVP.resolve();
    };

    /**
     * Loads the values and sets the required handlers of the option elements in the page.
     * @return {Array} An array of the initialized elements.
     * @private
     */
    var _initPage = function () {
        // We're done when ALL options are loaded.
        return RSVP.all([Applitools.optionsOpened(), _initNewTabForResults(), _initTakeFullPageScreenshot(),
            _initRemoveScrollBars(), _initEyesServerUrl(), _initRestoreDefaultUrlButton(),
            _initEyesApiServerUrl(), _initRestoreDefaultApiUrlButton(), _initPagePartWaitTime(),
            _initRestoreDefaultPagePartWaitTimeButton(), _restoreLogs()]);
    };

    document.addEventListener('DOMContentLoaded', _initPage);
}());
