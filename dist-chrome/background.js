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


    /**
     * Updates relevant items when a test is started.
     * @return {Promise} A promise which resolves to the current tests count.
     * @private
     */
    Applitools_._testStarted = function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 255, 127]});
        Applitools_.currentState.runningTestsCount++;
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        chrome.browserAction.setBadgeText({text: Applitools_.currentState.runningTestsCount.toString()});
        return RSVP.resolve(Applitools_.currentState.runningTestsCount);
    };

    /**
     * Updates relevant items when a test is ended.
     * @return {Promise} A promise which resolves to the number the current tests count.
     * @private
     */
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
     * Get the JSON information of an existing session.
     * @param sessionId The ID of the session which info we'd like to get.
     * @return {Promise} A promise which resolves to the JSON parsed session info.
     */
    Applitools_._getSessionInfo = function (sessionId) {
        var deferred = RSVP.defer();
        var sessionInfoUrl = 'https://eyes.applitools.com/api/sessions/' + sessionId + '.json';
        var infoRequest = new XMLHttpRequest();
        infoRequest.open('GET', sessionInfoUrl);
        //noinspection SpellCheckingInspection
        infoRequest.onload = function () {
            if (infoRequest.status === 200) {
                var testInfo;
                try {
                    testInfo = JSON.parse(infoRequest.responseText);
                    deferred.resolve(testInfo);
                } catch (e) {
                    deferred.reject('Failed to parse test info: ' + e);
                }
            } else {
                deferred.reject(new Error('Failed to get test info: ' + infoRequest.statusText));
            }
        };
        infoRequest.onerror = function () {
            deferred.reject(new Error("Network error when trying to get test info!"));
        };
        infoRequest.send();
        return deferred.promise;
    };

    /**
     * Gets the current test parameters, based on the user's selection of baseline.
     * @param {String} url The current URL (i.e., the URL of the page being tested).
     * @param {String} selectionId The user's baseline selection as would be stored by the ConfigurationStore.
     * @return {Promise} A promise which resolves to {testName: , appName: , viewportSize: {width: , height: }}
     * @private
     */
    Applitools_._getTestParameters = function (url, selectionId) {
        var testParamsPromise;
        if (selectionId === 'stepUrlSelection') {
            testParamsPromise = ConfigurationStore.getBaselineStepUrl().then(function (stepUrl) {
                var sessionIdRegexResult = /sessions\/(\d+)(?:\/|$)/.exec(stepUrl);
                if (!sessionIdRegexResult || sessionIdRegexResult.length !== 2) {
                    return RSVP.reject(new Error('Invalid step URL: ' + stepUrl));
                }
                var sessionId = sessionIdRegexResult[1];
                return Applitools_._getSessionInfo(sessionId).then(function (sessionInfo) {
                    var appName = sessionInfo.startInfo.appIdOrName;
                    var testName = sessionInfo.startInfo.scenarioIdOrName;
                    var branchName = sessionInfo.startInfo.branchName;
                    var parentBranchNAme = sessionInfo.startInfo.parentBranchName;
                    var os = sessionInfo.startInfo.environment.os;
                    var hostingApp = sessionInfo.startInfo.environment.hostingApp;
                    var viewportSize = {};
                    viewportSize.width = sessionInfo.startInfo.environment.displaySize.width;
                    viewportSize.height = sessionInfo.startInfo.environment.displaySize.height;
                    var testParams = {appName: appName, testName: testName, branchName: branchName,
                            parentBranchName: parentBranchNAme, os: os, hostingApp: hostingApp,
                            viewportSize: viewportSize};
                    return RSVP.resolve(testParams);
                });
            });
        } else {
            // If the user selected specific app and test names, we use them.
            if (selectionId === 'userValuesSelection') {
                testParamsPromise = ConfigurationStore.getBaselineAppName().then(function (appName) {
                    return ConfigurationStore.getBaselineTestName().then(function (testName) {
                        return RSVP.resolve({appName: appName, testName: testName});
                    });
                });
            } else { // Use the domain as the app name, and the path as the test name.
                var domainRegexResult = /https?:\/\/([\w\.]+)?\//.exec(url);
                var appName = domainRegexResult ? domainRegexResult[1] : url;
                var pathRegexResult = /https?:\/\/[\w\.]+?(\/\S*)(?:\?|$)/.exec(url);
                var testName = pathRegexResult ? pathRegexResult[1] : '/';
                testParamsPromise = RSVP.resolve({appName: appName, testName: testName});
            }

            testParamsPromise = testParamsPromise.then(function (testParams) {
                return ConfigurationStore.getViewportSize().then(function (viewportSizeStr) {
                    var values = viewportSizeStr.split('x');
                    var width = parseInt(values[0], 10);
                    var height = parseInt(values[1], 10);
                    testParams.viewportSize = {width: width, height: height};
                    return RSVP.resolve(testParams);
                });
            });
        }
        return testParamsPromise;
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
            .then(function () {
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
                //noinspection JSUnresolvedVariable
                var originalTabsCount = originalWindow.tabs.length;
                var originalWindowWidth = originalWindow.width;
                var originalWindowHeight = originalWindow.height;
                ConfigurationStore.getBaselineSelection().then(function (selectionId) {
                    Applitools_._getTestParameters(url, selectionId).then(function (testParams) {
                        var requiredViewportSize = testParams.viewportSize;
                        var updatedWindowPromise;
                        var isNewWindowCreated;
                        if (originalTabsCount > 1) {
                            // The window contains multiple tabs, so we'll move the current tab to a new window for
                            // resizing.
                            updatedWindowPromise = WindowHandler.moveTabToNewWindow(originalTab, requiredViewportSize);
                            isNewWindowCreated = true;
                        } else {
                            // The window only contains the current tab, so we'll just resize the current window.
                            updatedWindowPromise = RSVP.resolve(originalWindow);
                            isNewWindowCreated = false;
                        }
                        // Move the current tab to a new window, so not to resize all the user's tabs
                        updatedWindowPromise.then(function (newWindow) {
                            // Since the new window only includes a single tab.
                            //noinspection JSUnresolvedVariable
                            var movedTab = newWindow.tabs[0];
                            WindowHandler.setViewportSize(newWindow, movedTab, requiredViewportSize).then(function (resizedWindow) {
                                //noinspection JSUnresolvedVariable
                                var resizedTab = resizedWindow.tabs[0];

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
                                        restoredWindowPromise.then(function () {
                                            // Convert the image to a buffer.
                                            var image64 = imageDataUrl.replace('data:image/png;base64,', '');
                                            //noinspection JSUnresolvedFunction
                                            var image = new Buffer(image64, 'base64');

                                            // Run the test
                                            EyesRunner.testImage(testParams, image, title)
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
                                    }); // Capture visible tab
                                }, 1000);
                            }).catch(function (invalidSizeWindow) { //Handling resize failure.
                                // The window will only contain a single tab (the one we want).
                                //noinspection JSUnresolvedVariable
                                var resizedTab = invalidSizeWindow.tabs[0];
                                var restoredWindowPromise = Applitools_._restoreTab(resizedTab, isNewWindowCreated,
                                    invalidSizeWindow, originalWindow, originalTabIndex, {width: originalWindowWidth,
                                        height: originalWindowHeight});
                                restoredWindowPromise.then(function () {
                                    deferred.reject();
                                    Applitools_._testEnded();
                                });
                            });
                        });
                    }).catch(function (err) { // Handling test parameters extraction failure.
                        deferred.reject(err);
                        Applitools_._testEnded();
                    });
                }); // Get baseline selection
            });
            return deferred.promise;
        });
    };

    return Applitools_;
}());

