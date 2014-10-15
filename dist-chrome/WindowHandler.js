/**
 * Provides an api for manipulating browser windows and tabs.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp');

    var WindowHandler = {};

    /**
     * Moves the given tab to a new window
     * @param tab
     * @param {Object} windowSize (Optional) The size of the new window (including the window frame).
     *                              Should include width and height properties.
     * @return {Promise} A promise which resolves to the new window object when the window is created.
     */
    WindowHandler.moveTabToNewWindow = function (tab, windowSize) {
        var deferred = RSVP.defer();

        // Move the current tab to a new window
        var createData = {tabId: tab.id};
        if (windowSize) {
            createData.width = windowSize.width;
            createData.height = windowSize.height;
        }

        chrome.windows.create(createData, function (updatedWindow) {
            deferred.resolve(updatedWindow);
        });
        return deferred.promise;
    };

    /**
     * sets the window size.
     * @param theWindow The window to resize
     * @param {Object} requiredSize The size to set. Should include "width" and "height" properties.
     * @return {Promise} A promise which resolves to the updated window object.
     */
    WindowHandler.resizeWindow = function (theWindow, requiredSize) {
        var deferred = RSVP.defer();
        chrome.windows.update(theWindow.id, requiredSize, function (resizedWindow) {
            // Give the window 200ms to stabilize on the size.
            window.setTimeout(function () {
                chrome.windows.get(resizedWindow.id, {populate: true}, function (populatedResizedWindow) {
                    deferred.resolve(populatedResizedWindow);
                });
            }, 200);
        });
        return deferred.promise;
    };

    /**
     * Moves the given tab to the target window.
     * @param tab
     * @param targetWindow
     * @param {number} targetIndex (optional) The position of the tab in the tabs list of the window.
     * @param {boolean} makeActive (optional) Whether to set the tab as the active tab after it has been moved.
     * @return {Promise} A promise which resolves to the moved tab.
     */
    WindowHandler.moveTabToExistingWindow = function (tab, targetWindow, targetIndex, makeActive) {
        var deferred = RSVP.defer();
        var moveData = {windowId: targetWindow.id, index: targetIndex};
        chrome.tabs.move(tab.id, moveData, function (movedTab) {
            if (makeActive) {
                chrome.tabs.update(movedTab.id, {active: true}, function (activeTab) {
                    deferred.resolve(activeTab);
                });
            } else {
                deferred.resolve(movedTab);
            }
        });

        return deferred.promise;
    };

    /**
     * Sets the given tab's viewport size (i.e., the internal size, without the frame).
     * @param theWindow The window which contains the tab.
     * @param theTab The tab that its viewport we would like to set.
     * @param {Object} requiredViewportSize The required viewport size. Should have "width" and "height" properties.
     * @return {Promise} A promise which resolves to the resized window.
     */
    WindowHandler.setViewportSize = function (theWindow, theTab, requiredViewportSize) {
        var requiredWidth = theWindow.width + (requiredViewportSize.width - theTab.width);
        var requiredHeight = theWindow.height + (requiredViewportSize.height - theTab.height);

        var requiredWindowSize = {width: requiredWidth, height: requiredHeight};

        return WindowHandler.resizeWindow(theWindow, requiredWindowSize).then(function (resizedWindow) {
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // First retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // Second retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // First retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            // We couldn't reach the required size.
            return RSVP.reject(resizedWindow);
        });
    };

    module.exports = WindowHandler;
}());

