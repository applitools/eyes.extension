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

    var _DEFAULT_BROWSER_ACTION_TOOLTIP = "Applitools Eyes. No tests are currently running.";
    var _MAX_LOGS_COUNT = 100;
    var _APPLITOOLS_LOGIN_URL = 'https://applitools.com/login/';

    chrome.browserAction.setTitle({title: _DEFAULT_BROWSER_ACTION_TOOLTIP});

    var Applitools_ = {};

    // Add a listener to the run-test hotkey.
    chrome.commands.onCommand.addListener(function (command) {
        if (command === 'run-test') {
            return Applitools_.prepareToTest().then(function () {
                return Applitools_.runTest();
            });
        }
    });

    Applitools_.currentState = {
        tabToTest: undefined,
        runningTestsCount: 0,
        logs: [],
        newErrorsExist: false,  // errors were encountered since the last time the extension menu was opened
        unreadErrorsExist: false // errors were encountered and not read
    };

    /**
     * Logs a message.
     * @param {string} message The message to log
     * @return {Promise} A promise which resolves to the logged message.
     * @private
     */
    Applitools_._log = function (message) {
        // If the logs are more than a given max, we remove the oldest ones.
        var logsToRemoveCount =  Applitools_.currentState.logs.length - _MAX_LOGS_COUNT;
        logsToRemoveCount = logsToRemoveCount > 0 ? logsToRemoveCount : 0;
        Applitools_.currentState.logs = Applitools_.currentState.logs.slice(logsToRemoveCount);
        Applitools_.currentState.logs.push({timestamp: new Date(), message: message});
        return RSVP.resolve(message);
    };

    /**
     * Creates a log message from the given parameters.
     * @param appName The application name of the test.
     * @param testName The test name.
     * @param message The message to be logged.
     * @return {string} A log message which includes the application and test name.
     * @private
     */
    Applitools_._buildLogMessage = function (appName, testName, message) {
        return "'" + testName + "'" + " of '" + appName + "': " + message;
    };

    /**
     * Updates the browser action badge and title.
     * @param {boolean} isError Whether to display an error notification or a normal notification (if required).
     * @param {string|undefined} title (Optional) The browser action title will be set to this title.
     * @return {Promise} A promise which resolves when the badge is set.
     * @private
     */
    Applitools_.updateBrowserActionBadge = function (isError, title) {
        if (isError) {
            // Color is in RGBA format.
            chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
            if (!title) {
                title = 'An error occurred. Logs are available in the options page.';
            }
            chrome.browserAction.setTitle({title: title});
            chrome.browserAction.setBadgeText({text: '!'});
            return RSVP.resolve();
        }

        // If we're here then we want to update the badge with the number of running tests. However, we only update
        // this if we should not continue show the error.
        if (Applitools_.currentState.newErrorsExist) {
            return RSVP.resolve();
        }

        // Okay, we can update the badge with the number of running tests (or remove it if no tests are currently
        // running).
        if (Applitools_.currentState.runningTestsCount) {
            chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 255, 127]});
            chrome.browserAction.setBadgeText({text: Applitools_.currentState.runningTestsCount.toString()});
            if (!title) {
                title = 'Number of running tests: ' + Applitools_.currentState.runningTestsCount;
            }
            chrome.browserAction.setTitle({title: title});
        } else { // No running tests
            chrome.browserAction.setBadgeText({text: ''});
            chrome.browserAction.setTitle({title: _DEFAULT_BROWSER_ACTION_TOOLTIP});
        }
        return RSVP.resolve();
    };

    /**
     * @return {Promise} A promise which resolves to the current tab.
     * @private
     */
    var getCurrentTab = function () {
        var deferred = RSVP.defer();
        chrome.tabs.query({currentWindow: true, active: true}, function (tabsList) {
            // Since there's only one active tab in the current window,
            deferred.resolve(tabsList[0]);
        });
        return deferred.promise;
    };

    /**
     * Verifies that an API key is available, and saves the current tab.
     * @return {Promise} A promise which resolves when preparation is finished.
     */
    Applitools_.prepareToTest = function () {
        return getCurrentTab().then(function (currentTab) {
            // Making sure that API key is available.
            return ConfigurationStore.getApiKey().then(function (apiKey) {
                if (!apiKey) {
                    var deferred = RSVP.defer();
                    chrome.tabs.create({windowId: currentTab.windowId, url: _APPLITOOLS_LOGIN_URL, active: true},
                        function () {
                            Applitools_.updateBrowserActionBadge(true,
                                "You must be signed in to Applitools in order to use this extension.").
                                then(function () {
                                    deferred.resolve();
                                });
                        });
                    return deferred.promise;
                }
                Applitools_.currentState.tabToTest = currentTab;
                return RSVP.resolve();
            });
        });
    };

    /**
     * Extracts the relevant parts of a given URL.
     * @param stepUrl The url from which to extract parameters.
     * @return {object|null} An object containing the relevant parameters, or null if the URL is not in the correct
     *                          format.
     */
    Applitools_.extractStepUrlParameters = function (stepUrl) {
        var domainRegexResult = /https?:\/\/([\w\.]+)?\//.exec(stepUrl);
        var sessionIdRegexResult = /sessions\/(\d+)(?:\/|$)/.exec(stepUrl);
        if (!domainRegexResult || domainRegexResult.length !== 2 ||
                !sessionIdRegexResult || sessionIdRegexResult.length !== 2) {
            return null;
        }
        var domain = domainRegexResult[1];
        var sessionId = sessionIdRegexResult[1];
        return {domain: domain, sessionId: sessionId};
    };

    /**
     * Notifies the background script that the popup page had been opened.
     * @return {Promise} A promise which resolves when finished the required handling.
     */
    Applitools_.popupOpened = function () {
        // If there was an error badge, we can stop displaying it.
        Applitools_.currentState.newErrorsExist = false;
        return Applitools_.updateBrowserActionBadge(false, undefined);
    };

    /**
     * Notifies the background script that the options page had been opened.
     * @return {Promise} A promise which resolves when finished the required handling.
     */
    Applitools_.optionsOpened = function () {
        // Any unread errors are now read.
        Applitools_.currentState.unreadErrorsExist = false;
        return RSVP.resolve();
    };

    /**
     * Processes an error.
     * @param {string} errorMessage The message describing the error.
     * @param {string|undefined} appName (Optional) The test's application name .
     * @param {string|undefined} testName (Optional) The test name.
     * @return {Promise} A promise which resolves when finished the required operations onError.
     * @private
     */
    Applitools_._onError = function (errorMessage, appName, testName) {
        if (!errorMessage) {
            errorMessage = 'Unknown error occurred.';
        }
        errorMessage = Applitools_._buildLogMessage(appName, testName, 'Error: ' + errorMessage);
        return Applitools_._log(errorMessage).then(function () {
            Applitools_.currentState.newErrorsExist = Applitools_.currentState.unreadErrorsExist = true;
            return Applitools_.updateBrowserActionBadge(true, undefined).then(function () {
                return Applitools_._testEnded(appName, testName);
            });
        });
    };

    /**
     * Updates relevant items when a test is started.
     * @return {Promise} A promise which resolves to the current tests count.
     * @private
     */
    Applitools_._testStarted = function () {
        Applitools_.currentState.runningTestsCount++;
        return Applitools_._log("Test started").then(function () {
            return Applitools_.updateBrowserActionBadge(false, undefined).then(function () {
                return RSVP.resolve(Applitools_.currentState.runningTestsCount);
            });
        });
    };

    /**
     * Updates relevant items when a test is ended.
     * @param {string|undefined} appName (Optional) The application name of the test.
     * @param {string|undefined} testName (Optional) The test name.
     * @return {Promise} A promise which resolves to the number the current tests count.
     * @private
     */
    Applitools_._testEnded = function (appName, testName) {
        Applitools_.currentState.runningTestsCount--;

        if (Applitools_.currentState.runningTestsCount <= 0) {
            Applitools_.currentState.runningTestsCount = 0;
        }

        var logMessage = "Test ended"; // default message
        if (appName || testName) {
            logMessage = Applitools_._buildLogMessage(appName, testName, logMessage);
        }
        return Applitools_._log(logMessage).then(function () {
            return Applitools_.updateBrowserActionBadge(false, undefined).then(function () {
                return RSVP.resolve(Applitools_.currentState.runningTestsCount);
            });
        });
    };

    /**
     * Get the JSON information of an existing session.
     * @param {string} domain The domain of the server from which to extract the session information.
     * @param {string} sessionId The ID of the session which info we'd like to get.
     * @return {Promise} A promise which resolves to the JSON parsed session info.
     */
    Applitools_._getSessionInfo = function (domain, sessionId) {
        var deferred = RSVP.defer();
        var sessionInfoUrl = 'https://' + domain + '/api/sessions/' + sessionId + '.json';
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
        return ConfigurationStore.getMatchLevel().then(function (matchLevel) {
            var testParamsPromise;
            if (selectionId === 'stepUrlSelection') {
                testParamsPromise = ConfigurationStore.getBaselineStepUrl().then(function (stepUrl) {
                    var stepUrlParams = Applitools_.extractStepUrlParameters(stepUrl);
                    if (!stepUrlParams) {
                        return RSVP.reject(new Error('Invalid step URL: ' + stepUrl));
                    }
                    var domain = stepUrlParams.domain;
                    var sessionId = stepUrlParams.sessionId;
                    return Applitools_._getSessionInfo(domain, sessionId).then(function (sessionInfo) {
                        var appName = sessionInfo.startInfo.appIdOrName;
                        var testName = sessionInfo.startInfo.scenarioIdOrName;
                        var branchName = sessionInfo.startInfo.branchName;
                        var parentBranchNAme = sessionInfo.startInfo.parentBranchName;
                        var os = sessionInfo.startInfo.environment.os;
                        var hostingApp = sessionInfo.startInfo.environment.hostingApp;
                        var inferred = sessionInfo.startInfo.environment.inferred;
                        var viewportSize = {};
                        viewportSize.width = sessionInfo.startInfo.environment.displaySize.width;
                        viewportSize.height = sessionInfo.startInfo.environment.displaySize.height;
                        var testParams = {appName: appName, testName: testName, branchName: branchName,
                            parentBranchName: parentBranchNAme, os: os, hostingApp: hostingApp, inferred: inferred,
                            viewportSize: viewportSize, matchLevel: matchLevel};
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
                    testParams.matchLevel = matchLevel;
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
        });
    };

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
                chrome.tabs.get(tab.id, function (restoredTab) {
                    deferred.resolve(restoredTab);
                });
                return deferred.promise;
            });
    };

    /**
     * Runs a test for a given tab.
     * @return {Promise} A promise which resolves when the test ends (or rejects on error).
     */
    Applitools_.runTest = function () {
        var deferred = RSVP.defer();

        Applitools_._testStarted();

        var tabToTest = Applitools_.currentState.tabToTest;
        //properties of tab object
        var title = tabToTest.title;
        var url = tabToTest.url;
        var originalWindowId = tabToTest.windowId;
        var originalTabIndex = tabToTest.index;

        chrome.windows.get(originalWindowId, {populate: true}, function (originalWindow) {
            var originalTabsCount = originalWindow.tabs.length;
            var originalWindowWidth = originalWindow.width;
            var originalWindowHeight = originalWindow.height;
            ConfigurationStore.getBaselineSelection().then(function (selectionId) {
                Applitools_._getTestParameters(url, selectionId).then(function (testParams) {
                    var testParamsLogMessage = Applitools_._buildLogMessage(testParams.appName, testParams.testName,
                        "Got tests parameters");
                    Applitools_._log(testParamsLogMessage);

                    var requiredViewportSize = testParams.viewportSize;
                    var updatedWindowPromise;
                    var isNewWindowCreated;
                    if (originalTabsCount > 1) {
                        // The window contains multiple tabs, so we'll move the current tab to a new window for
                        // resizing.
                        updatedWindowPromise = WindowHandler.moveTabToNewWindow(tabToTest, requiredViewportSize);
                        isNewWindowCreated = true;
                    } else {
                        // The window only contains the current tab, so we'll just resize the current window.
                        updatedWindowPromise = RSVP.resolve(originalWindow);
                        isNewWindowCreated = false;
                    }
                    // Move the current tab to a new window, so not to resize all the user's tabs
                    updatedWindowPromise.then(function (newWindow) {
                        // Since the new window only includes a single tab.
                        var movedTab = newWindow.tabs[0];
                        WindowHandler.setViewportSize(newWindow, movedTab, requiredViewportSize).then(function (resizedWindow) {
                            var resizedTab = resizedWindow.tabs[0];

                            // We wait a bit before actually taking the screenshot to give the page time to redraw.
                            setTimeout(function () {
                                // Get a screenshot of the current tab as PNG.
                                chrome.tabs.captureVisibleTab({format: "png"}, function (imageDataUrl) {
                                    var restoredWindowPromise;
                                    var newWindowCreated = originalTabsCount > 1;
                                    restoredWindowPromise = Applitools_._restoreTab(resizedTab, newWindowCreated,
                                        resizedWindow, originalWindow, originalTabIndex, {width: originalWindowWidth,
                                            height: originalWindowHeight});
                                    restoredWindowPromise.then(function () {
                                        // Convert the image to a buffer.
                                        var image64 = imageDataUrl.replace('data:image/png;base64,', '');
                                        var image = new Buffer(image64, 'base64');

                                        // Run the test
                                        EyesRunner.testImage(testParams, image, title)
                                            .then(function (testResults) {
                                                ConfigurationStore.getNewTabForResults()
                                                    .then(function (shouldOpen) {
                                                        if (shouldOpen) {
                                                            chrome.tabs.create({windowId: originalWindowId, url: testResults.url, active: false},
                                                                function () {
                                                                    deferred.resolve(testResults);
                                                                    Applitools_._testEnded(testParams.appName,
                                                                        testParams.testName);
                                                                });
                                                        } else {
                                                            deferred.resolve(testResults);
                                                            Applitools_._testEnded(testParams.appName,
                                                                testParams.testName);
                                                        }
                                                    });
                                            }).catch(function () {
                                                deferred.reject();
                                                Applitools_._onError("An error occurred while running the test.",
                                                    testParams.appName, testParams.testName);
                                            });
                                    });
                                }); // Capture visible tab
                            }, 1000);
                        }).catch(function (invalidSizeWindow) { //Handling resize failure.
                            // The window will only contain a single tab (the one we want).
                            var resizedTab = invalidSizeWindow.tabs[0];
                            var restoredWindowPromise = Applitools_._restoreTab(resizedTab, isNewWindowCreated,
                                invalidSizeWindow, originalWindow, originalTabIndex, {width: originalWindowWidth,
                                    height: originalWindowHeight});
                            restoredWindowPromise.then(function () {
                                deferred.reject();
                                Applitools_._onError('Failed to set viewport size ' + requiredViewportSize.width + 'x' +
                                    requiredViewportSize.height + ' (got ' + resizedTab.width +
                                    'x' + resizedTab.height + ' instead)', testParams.appName, testParams.testName);
                            });
                        });
                    });
                }).catch(function (err) { // Handling test parameters extraction failure.
                    deferred.reject(err);
                    Applitools_._onError('Failed to extract test parameters: ' +  err, undefined, undefined);
                });
            }); // Get baseline selection
        });
        return deferred.promise;
    };

    return Applitools_;
}());

