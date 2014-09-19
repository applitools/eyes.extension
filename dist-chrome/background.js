/**
 * Background script for the extension. All code which should still run
 */
window.Applitools = (function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var EyesRunner = require('./../EyesRunner.js'),
        ConfigurationStore = require('./../ConfigurationStore.js'),
        WindowHandler = require('./WindowHandler.js'),
        RSVP = require('rsvp');

    var Applitools_ = {};

    Applitools_.currentState = {
        runningTestsCount: 0
    };


    Applitools_._testStarted = function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 255, 127]});
        Applitools_.currentState.runningTestsCount++;
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        chrome.browserAction.setBadgeText({text: Applitools_.currentState.runningTestsCount.toString()});
        return RSVP.resolve(Applitools_.currentState.runningTestsCount);
    };

    Applitools_._testEnded = function () {
        Applitools_.currentState.runningTestsCount--;

        if (Applitools_.currentState.runningTestsCount <= 0) {
            Applitools_.currentState.runningTestsCount = 0;
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            chrome.browserAction.setBadgeText({text: ''});
        } else {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            chrome.browserAction.setBadgeText({text: Applitools_.currentState.runningTestsCount.toString()});
        }
        return RSVP.resolve(Applitools_.currentState.runningTestsCount);
    };

    /**
     * Loads the current viewport size from storage.
     * @return {Promise} A promise which resolves to the viewport size as {width:.., height:..}
     * @private
     */
    Applitools_._getSelectedViewportSize = function () {
        return ConfigurationStore.getViewportSize().then(function (viewportSizeStr) {
            var values = viewportSizeStr.split('x');
            var width = parseInt(values[0], 10);
            var height = parseInt(values[1], 10);
            return RSVP.resolve({width: width, height: height});
        });
    };

    //noinspection JSValidateJSDoc
    /**
     * Restores the tab to it's original window (if there was such a window), otherwise returns the tab to its
     * original size.
     * @param {Tab} tab The tab we would like to restore.
     * @param {boolean} newWindowCreated Whether or not a new window was created for resizing the tab.
     * @param {Window} resizedWindow The Window instance of the which contains the tab after it was resized.
     * @param {Window} originalWindow The Window instance of the window the tab was taken from, or {@code undefined} if
     *                                  the tab wasn't moved the a new window.
     * @param {Number} originalTabIndex The index of the tab in the original window, or {@code undefined} if
     *                                  {@code originalWindow} is {@code undefined}.
     * @param {Object} originalSize The original size of {@code tab}. Required if {@code originalWindow} is
     *                              {@code undefined}.
     * @return {Promise} A promise which resolves to the restored tab.
     * @private
     */
    Applitools_._restoreTab = function (tab, newWindowCreated, resizedWindow, originalWindow, originalTabIndex,
                                        originalSize) {
        if (newWindowCreated) {
            // If moved the tab out of its original window for resizing, we'll move it back.
            return WindowHandler.moveTabToExistingWindow(tab, originalWindow, originalTabIndex, true);
        }
        // If we used the original window, we resize it back to its original size.
        return WindowHandler.resizeWindow(resizedWindow, {width: originalSize.width, height: originalSize.height})
            .then(function (restoredWindow) {
                var deferred = RSVP.defer();
                //noinspection JSUnresolvedVariable
                chrome.tabs.get(tab.id, function (restoredTab) {
                    deferred.resolve(restoredTab);
                });
                return deferred.promise;
            });
    };

    Applitools_.runTest = function () {
        var deferred = RSVP.defer();

        Applitools_._testStarted();

        // Get properties of the current tab.
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        chrome.tabs.query({currentWindow: true, active: true}, function (tabsList) {
            var originalTab = tabsList[0];
            //properties of tab object
            var title = originalTab.title;
            var url = originalTab.url;
            var originalWindowId = originalTab.windowId;
            var originalTabIndex = originalTab.index;

            //noinspection JSUnresolvedVariable
            chrome.windows.get(originalWindowId, {populate: true}, function (originalWindow) {
                var originalTabsCount = originalWindow.tabs.length;
                var originalWindowWidth = originalWindow.width;
                var originalWindowHeight = originalWindow.height;
                Applitools_._getSelectedViewportSize().then(function (requiredViewportSize) {
                    var updatedWindowPromise;
                    if (originalTabsCount > 1) {
                        // The window contains multiple tabs, so we'll move the current tab to a new window for
                        // resizing.
                        updatedWindowPromise = WindowHandler.moveTabToNewWindow(originalTab, requiredViewportSize);
                    } else {
                        // The window only contains the current tab, so we'll just resize the current window.
                        updatedWindowPromise = RSVP.resolve(originalWindow);
                    }
                    // Move the current tab to a new window, so not to resize all the user's tabs
                    updatedWindowPromise.then(function (newWindow) {
                        // Since the new window only includes a single tab.
                        //noinspection JSUnresolvedVariable
                        var movedTab = newWindow.tabs[0];
                        WindowHandler.setViewportSize(newWindow, movedTab, requiredViewportSize).then(function (resizedWindow) {
                            //noinspection JSUnresolvedVariable
                            var resizedTab = resizedWindow.tabs[0];

                            var actualViewportSize = {width: resizedTab.width, height: resizedTab.height};

                            // We wait a bit before actually taking the screenshot to give the page time to redraw.
                            setTimeout(function () {
                                // Get a screenshot of the current tab as PNG.
                                //noinspection JSUnresolvedFunction,JSUnresolvedVariable
                                chrome.tabs.captureVisibleTab({format: "png"}, function (imageDataUrl) {
                                    var restoredWindowPromise;
                                    var newWindowCreated = originalTabsCount > 1;
                                    restoredWindowPromise = Applitools_._restoreTab(resizedTab, newWindowCreated,
                                        resizedWindow, originalWindow, originalTabIndex, {width: originalWindowWidth,
                                                                                        height: originalWindowHeight});
                                    restoredWindowPromise.then(function (restoredTab) {
                                        // Convert the image to a buffer.
                                        var image64 = imageDataUrl.replace('data:image/png;base64,', '');
                                        //noinspection JSUnresolvedFunction
                                        var image = new Buffer(image64, 'base64');

                                        // FIXME Daniel - Add step URL handling

                                        ConfigurationStore.getBaselineSelection().then(function (selectionId) {
                                            ConfigurationStore.getBaselineAppName().then(function (appName) {
                                                ConfigurationStore.getBaselineTestName().then(function (testName) {
                                                    if (!selectionId) {
                                                        // Use the domain as the app name, and the path as the test name.
                                                        var domainRegexResult = /https?:\/\/([\w\.]+)?\//.exec(url);
                                                        appName = domainRegexResult ? domainRegexResult[1] : url;
                                                        var pathRegexResult = /https?:\/\/[\w\.]+?(\/\S*)(?:\?|$)/.exec(url);
                                                        testName = pathRegexResult ? pathRegexResult[1] : '/';
                                                    }

                                                    // Run the test
                                                    EyesRunner.testImage(appName, testName, image, title,
                                                        actualViewportSize)
                                                        .then(function (testResults) {
                                                            ConfigurationStore.getNewTabForResults()
                                                                .then(function (shouldOpen) {
                                                                    if (shouldOpen) {
                                                                        //noinspection JSUnresolvedVariable
                                                                        chrome.tabs.create({windowId: originalWindowId, url: testResults.url, active: false},
                                                                            function () {
                                                                                deferred.resolve(testResults);
                                                                                Applitools_._testEnded();
                                                                            });
                                                                    } else {
                                                                        deferred.resolve(testResults);
                                                                        Applitools_._testEnded();
                                                                    }
                                                                });
                                                        });
                                                });
                                            });
                                        });
                                    });
                                }); // Capture visible tab
                            }, 1000);
                        }, function (invalidSizeWindow) { //Handling resize failure
                            // We use tabs[0] whether it's a new window, or the original window only contained the active
                            // tab, there's only a single tab in the window.
                            //noinspection JSUnresolvedVariable
                            var resizedTab = invalidSizeWindow.tabs[0];
                            var newWindowCreated = originalTabsCount > 1;
                            var restoredWindowPromise = Applitools_._restoreTab(resizedTab, newWindowCreated,
                                invalidSizeWindow, originalWindow, originalTabIndex, {width: originalWindowWidth,
                                    height: originalWindowHeight});
                            restoredWindowPromise.then(function (restoredTab) {
                                deferred.reject();
                                Applitools_._testEnded();
                            });
                        });
                    });
                });
            });
            return deferred.promise;
        });
    };

    return Applitools_;
}());

