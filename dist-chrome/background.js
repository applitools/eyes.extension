/**
 * Background script for the extension. All code which should still run even when the extension window is not visible.
 */
window.Applitools = (function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var EyesHandler = require('./../EyesHandler.js'),
        ChromeUtils = require('./ChromeUtils.js'),
        GeneralUtils = require('eyes.utils').GeneralUtils,
        JSUtils = require('./../JSUtils.js'),
        ConfigurationStore = require('./../ConfigurationStore.js'),
        WindowHandler = require('./WindowHandler.js'),
        StepsHandler = require('../StepsHandler.js'),
        BaselineImageHandler = require('../BaselineImageHandler.js'),
        UserAuthHandler = require('../UserAuthHandler.js'),
        RSVP = require('rsvp');

    var _DEFAULT_BROWSER_ACTION_TOOLTIP = 'Applitools Eyes. No tests are currently running.';
    var _MAX_LOGS_COUNT = 100;
    var _MAX_PARALLEL_CRAWLER_TABS = 5;
    var _TAB_LOAD_TIME_MS = 10000;

    // Keeps a mapping of baseline ID to tab ID in order to reuse result tabs
    var _resultTabs = {};

    // A mapping of tabId to currently running tests (appName & testName).
    var _testTabs = {};

    var Applitools_ = {};

    var _stepsHandler;
    var _stepsResultsTabId; // When working in "steps" mode, we want all results to be opened in the same tab.

    var _baselineImageHandler;
    var _isBaselineImageLoadingEnabled = true;

    var _userAuthHandler = new UserAuthHandler();

    Applitools_.currentState = {
        screenshotTakenMutex: {},
        batchId: undefined,
        runningTestsCount: 0,
        logs: [],
        newErrorsExist: false,  // errors were encountered since the last time the extension menu was opened
        unreadErrorsExist: false // errors were encountered and not read
    };

    chrome.browserAction.setTitle({title: _DEFAULT_BROWSER_ACTION_TOOLTIP});

    // Add a listener to the run-test hotkey.
    chrome.commands.onCommand.addListener(function (command) {
        if (command === 'run-test') {
            return Applitools_.verifyUserAccount().then(function () {
                    return Applitools_.runSingleTest();
            });
        }
    });

    chrome.tabs.onRemoved.addListener(function (tabId) {
        // If a tab was used in a test, and is closed before we finished with it, the test will crash.
        // So we decrease the number of running tests.
        if (_testTabs[tabId] !== undefined && _testTabs[tabId] !== false) {
            var appName = _testTabs[tabId].appName;
            var testName = _testTabs[tabId].testName;
            Applitools_.currentState.runningTestsCount =
                Applitools_.currentState.runningTestsCount - 1 > 0 ? Applitools_.currentState.runningTestsCount - 1 : 0;

            // TODO Daniel - Use testEnded instead
            // Remove this tab from our list of tabs.
            delete _testTabs[tabId];
            Applitools_.updateBrowserActionBadge(false, undefined).then(function () {
                // Log the event.
                var msg = Applitools_._buildLogMessage(appName, testName, "Tab was closed before tests was finished!");
                return Applitools_._log(msg);
            });
        }
    });

    /**
     * Create a step list from a given string
     * @param {string} s The string from which to create the steps list. Steps are separated by the new-line character.
     * @returns {Promise} A promise which resolves when the steps are loaded.
     */
    Applitools_.createStepListFromString = function (s) {
        return new RSVP.Promise(function (resolve) {
            return StepsHandler.createFromString(s).then(function (stepsHandler) {
                _stepsHandler = stepsHandler;
                _stepsResultsTabId = undefined;
                resolve();
            }.bind(this));
        }.bind(this));
    };

    /**
     * @returns {Promise} A promise which resolves when removing the steps is done.
     */
    Applitools_.removeSteps = function () {
        _stepsHandler = undefined;
        return RSVP.resolve();
    };

    /**
     * @returns {Promise} A promise which resolves to the steps count, or {@code undefined} if there are no steps
     *                     available.
     */
    Applitools_.getStepsCount = function () {
        if (_stepsHandler) {
            return _stepsHandler.getStepsCount();
        }

        return RSVP.resolve(undefined);
    };

    /**
     * @returns {Promise} A promise which resolves to the index of the current step, or {@code undefined} if no steps
     *                    are available.
     */
    Applitools_.getCurrentStepIndex = function () {
        if (_stepsHandler) {
            return _stepsHandler.getCurrentStepIndex();
        }

        return RSVP.resolve(undefined);
    };

    /**
     * @returns {Promise} A promise which resolves to the current step, or {@code undefined} if no steps are available.
     */
    Applitools_.getCurrentStep = function () {
        if (_stepsHandler) {
            return _stepsHandler.getCurrentStep();
        }

        return RSVP.resolve(undefined);
    };

    /**
     * Move to the next step on the steps list.
     * @returns {Promise} A promise which resolves to the next step, or to the current step if it is the last one,
     *                    or to {@code undefined} if there was an error.
     */
    Applitools_.moveToNextStep = function () {
        if (_stepsHandler) {
            return _stepsHandler.moveToNextStep();
        }
        return RSVP.resolve(undefined);
    };

    /**
     * Move to the previous step on the steps list.
     * @returns {Promise} A promise which resolves to the previous step, or to the current step if it is the first one,
     *                    or to {@code undefined} if there was an error.
     */
    Applitools_.moveToPrevStep = function () {
        if (_stepsHandler) {
            return _stepsHandler.moveToPrevStep();
        }
        return RSVP.resolve(undefined);
    };

    /**
     * Move to the step with the given index.
     * @param {number} stepIndex The index of the step to move to.
     * @returns {Promise} A promise which resolves to the step with the given index, or to {@code undefined} if
     *                    there was an error.
     */
    Applitools_.moveToStep = function (stepIndex) {
        if (_stepsHandler) {
            return _stepsHandler.moveToStep(stepIndex);
        }
        return RSVP.resolve(undefined);
    };

    /**
     * @returns {boolean} {@code true} if baseline image loading is enabled, {@code false} otherwise.
     */
    Applitools_.isBaselineImageLoadingEnabled = function () {
        return !!_isBaselineImageLoadingEnabled;
    };

    /**
     * Sets whether or not loading a baseline image is enabled. Notice that this doesn't mean that an image had been
     * loaded, it only means whether or not it is possible(!) to load an image.
     */
    Applitools_.setBaselineImageLoadingEnabled = function (isEnabled) {
        _isBaselineImageLoadingEnabled = isEnabled;
    };

    /**
     *
     * @returns {boolean} {@code true} if an image was loaded to be used as a baseline, {@code false} otherwise.
     */
    Applitools_.isImageAsBaselineLoaded = function () {
        return !!_baselineImageHandler;
    };

    /**
     * Mark the currently loaded image as a baseline for use.
     * @returns {Promise} A promise which resolves once the value is set, or rejects if no image was previously loaded.
     */
    Applitools_.setShouldUseImageAsBaseline = function (shouldUse) {
        if (_baselineImageHandler) {
            return _baselineImageHandler.setShouldUse(shouldUse);
        }
        return Promise.reject();
    };

    /**
     * @returns {boolean} Whether or not we should use a baseline image.
     */
    Applitools_.getShouldUseImageAsBaseline = function () {
        return _baselineImageHandler && _baselineImageHandler.getShouldUse();
    };

    /**
     * @returns {string|undefined} The filename of the baseline image to use, or undefined if no image is loaded.
     */
    Applitools_.getBaselineImageName = function () {
        return _baselineImageHandler ? _baselineImageHandler.getFilename() : undefined;
    };

    /**
     * Prepares an image to be used as a baseline
     * @param {Buffer} image The image to be used as a baseline.
     * @param {string} name The image file name.
     * @returns {Promise} A promise which resolves when the image is set.
     */
    Applitools_.prepareImageForBaseline = function (image, name) {
        return new Promise(function (resolve) {
            return BaselineImageHandler.createFromImage(image, name)
                .then(function (baselineImageHandler) {
                    _baselineImageHandler = baselineImageHandler;
                    resolve();
                });
        });
    };

    /**
     * Get the current batch ID.
     * @return {string|undefined} The current batch ID, or undefined if no batchID is available.
     * @private
     */
    Applitools_.getCurrentBatchId = function () {
        return Applitools_.currentState.batchId;
    };

    /**
     * Sets a new batch ID in the background script state.
     * @private
     */
    Applitools_.resetBatchId = function () {
        Applitools_.currentState.batchId = GeneralUtils.guid();
    };

    // TODO Daniel - Move this out of Applitools_ to the current file scope
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

    // TODO Daniel - Move this out of Applitools_ to the current file scope
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
            chrome.browserAction.setBadgeBackgroundColor({color: [59, 131, 241, 255]});
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
     * Verifies that the user is logged in and has a valid account in the Eyes server. If the user is not logged in,
     * this function opens a tab to the login/auth/access-denied page.
     * @return {Promise} A promise which resolves if the user is authenticated, or rejects otherwise.
     */
    Applitools_.verifyUserAccount = function () {
        return _userAuthHandler.loadCredentials()
            .catch(function (err) {
                return Applitools_._log(err)
                    .then(function () {
                        return new RSVP.Promise(function (resolve, reject) {
                            ChromeUtils.getCurrentTab().then(function (currentTab) {
                                chrome.tabs.create({
                                    windowId: currentTab.windowId,
                                    url: _userAuthHandler.getUserCredentialsRedirectUrl(),
                                    active: true
                                }, function () {
                                    Applitools_.updateBrowserActionBadge(true,
                                        'You must be signed in to the Eyes server and have at least one account, in order to use this extension.').
                                        then(function () {
                                            reject();
                                        });
                                });
                            });
                        });
                    });
            });
    };

    /**
     * Notifies the background script that the popup page had been opened.
     * @return {Promise} A promise which resolves when finished the required handling.
     */
    Applitools_.popupOpened = function () {
        // If there was an error badge, we can stop displaying it.
        Applitools_.currentState.newErrorsExist = false;
        return Applitools_.updateBrowserActionBadge(false, undefined)
            .then(function () {
                return Applitools_.verifyUserAccount();
            });
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
     * @return {UserAuthHandler} The user authentication handler object.
     */
    Applitools_.getUserAuthHandler = function () {
        return _userAuthHandler;
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
            return Applitools_.updateBrowserActionBadge(true, undefined);
        });
    };

    /**
     * Updates relevant items when a test is started.
     * @param {number} tabId the ID of the tab for which a test is run.
     * @param {string} appName The test's application name.
     * @param {number} testName The test's name.
     * @return {Promise} A promise which resolves to the current tests count.
     * @private
     */
    Applitools_._testStarted = function (tabId, appName, testName) {
        // Updating the currently used tabs.
        _testTabs[tabId] = {appName: appName, testName: testName};
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
     * @private
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
     * Returns the default test name given a URL.
     * @param {string} url The url from which to extract the default test name.
     * @return {Promise} A promise which resolves to the default test name.
     * @private
     */
    Applitools_._getDefaultTestName = function (url) {
        return ConfigurationStore.getIncludeQueryParamsForTestName().then(function (shouldInclude) {
            var pathRegexResult;
            if (shouldInclude) {
                pathRegexResult = /https?:\/\/[^\r\n]+?(\/[^\r\n]*?)$/.exec(url);
            } else {
                pathRegexResult = /https?:\/\/[^\r\n]+?(\/[^\r\n]*?)(?:\?|$)/.exec(url);
            }
            var testName = 'Homepage'; // default
            if (pathRegexResult && pathRegexResult[1] !== '/' && pathRegexResult[1] !== '/?') {
                testName = pathRegexResult[1];
            }
            return testName;
        });
    };

    /**
     * Clones a test parameters object.
     * @param {Object} testParams The tests parameters object to clone.
     * @return {Object} A cloned test parameters object.
     * @private
     */
    Applitools_._cloneTestParams = function (testParams) {
        var clonedParams = { appName: testParams.appName,
                            testName: testParams.testName,
                            branchName: testParams.branchName,
                            parentBranchName: testParams.parentBranchName,
                            os: testParams.os,
                            hostingApp: testParams.hostingApp,
                            inferred: testParams.inferred,
                            matchLevel: testParams.matchLevel,
                            viewportSize: { width: testParams.viewportSize.width,
                                            height: testParams.viewportSize.height
                                          }
                            };
        // Optional
        if (testParams.batch) {
            clonedParams.batch = {
                name: testParams.batch.name,
                id: testParams.batch.id
            };
        }

        return clonedParams;
    };

    /**
     * Gets the current test parameters, based on the user's selection of baseline.
     * @param {String} currentUrl The URL of the page the user is currently in.
     * @param {boolean} forceDefaultTestName Whether the test name should be the default value even if the user
     *                                      supplied a test name/step url (e.g, for tests crawled).
     * @return {Promise} A promise which resolves to {testName: , appName: , viewportSize: {width: , height: }}
     * @private
     */
    Applitools_._getTestParameters = function (currentUrl, forceDefaultTestName) {
        var matchLevel, baselineSelectionId, shouldUseBatch, defaultTestName;

        return ConfigurationStore.getMatchLevel().then(function (matchLevel_) {
            matchLevel = matchLevel_;
            return ConfigurationStore.getBaselineSelection();
        }).then(function (baselineSelectionId_) {
            baselineSelectionId = baselineSelectionId_;
        }).then(function () {
            return ConfigurationStore.getShouldUseBatch();
        }).then(function (shouldUseBatch_) {
            shouldUseBatch = shouldUseBatch_;
        }).then(function () {
            return Applitools_._getDefaultTestName(currentUrl);
        }).then(function (defaultTestName_) {
            defaultTestName = defaultTestName_;
            var testParamsPromise;

            if (baselineSelectionId === 'stepUrlSelection' && _stepsHandler === undefined) {
                testParamsPromise = ConfigurationStore.getBaselineStepUrl().then(function (baselineStepUrl) {
                    var baselineStepUrlParams = Applitools_.extractStepUrlParameters(baselineStepUrl);
                    if (!baselineStepUrlParams) {
                        return RSVP.reject(new Error('Invalid baseline step URL: ' + baselineStepUrl));
                    }
                    var domain = baselineStepUrlParams.domain;
                    var sessionId = baselineStepUrlParams.sessionId;
                    return Applitools_._getSessionInfo(domain, sessionId).then(function (sessionInfo) {
                        var appName = sessionInfo.startInfo.appIdOrName;
                        var testName = forceDefaultTestName ? defaultTestName : sessionInfo.startInfo.scenarioIdOrName;
                        var branchName = sessionInfo.startInfo.branchName;
                        var parentBranchName = sessionInfo.startInfo.parentBranchName;
                        var os = sessionInfo.startInfo.environment.os;
                        var hostingApp = sessionInfo.startInfo.environment.hostingApp;
                        var inferred = sessionInfo.startInfo.environment.inferred;
                        var viewportSize = {};
                        viewportSize.width = sessionInfo.startInfo.environment.displaySize.width;
                        viewportSize.height = sessionInfo.startInfo.environment.displaySize.height;
                        var testParams = {appName: appName, testName: testName, branchName: branchName,
                            parentBranchName: parentBranchName, os: os, hostingApp: hostingApp, inferred: inferred,
                            viewportSize: viewportSize, matchLevel: matchLevel};
                        return RSVP.resolve(testParams);
                    });
                });
            } else {
                var domainRegexResult = /https?:\/\/([^\r\n]+?)(?:\/|:|\?|#|$)/.exec(currentUrl);
                var defaultAppName = domainRegexResult ? domainRegexResult[1] : currentUrl;
                // If the user selected specific app and test names, we use them.
                if (baselineSelectionId === 'userValuesSelection') {
                    testParamsPromise = ConfigurationStore.getBaselineAppName().then(function (appName) {
                        return ConfigurationStore.getBaselineTestName().then(function (baselineTestName) {
                            appName = appName || defaultAppName;
                            var testNamePromise;
                            if (forceDefaultTestName) {
                                testNamePromise = RSVP.resolve(defaultTestName);
                            } else if (shouldUseBatch && _stepsHandler !== undefined) {
                                testNamePromise = _stepsHandler.getCurrentStep();
                            } else {
                                testNamePromise = RSVP.resolve(baselineTestName || defaultTestName);
                            }
                            return testNamePromise.then(function (testName) {
                                return RSVP.resolve({appName: appName, testName: testName});
                            });
                        });
                    });
                } else { // Use the domain as the app name, and the path as the test name.
                    var testNamePromise;
                    if (shouldUseBatch && _stepsHandler !== undefined) {
                        testNamePromise = _stepsHandler.getCurrentStep();
                    } else {
                        testNamePromise = RSVP.resolve(defaultTestName);
                    }

                    testParamsPromise = testNamePromise.then(function (testName) {
                        return RSVP.resolve({appName: defaultAppName, testName: testName});
                    });
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
     * @param {chrome.tabs.Tab} tab The tab we would like to restore.
     * @param {boolean} newWindowCreated Whether or not a new window was created for resizing the tab.
     * @param {chrome.windows.Window} resizedWindow The Window instance of the which contains the tab after it was
     *                                              resized.
     * @param {chrome.windows.Window|undefined} originalWindow The Window instance of the window the tab was taken from,
     *                                                          or {@code undefined} if the tab wasn't moved the a new
     *                                                          window.
     * @param {Number|undefined} originalTabIndex The index of the tab in the original window, or {@code undefined} if
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
     * Prepares the window for running a test (e.g., move the current tab to a new window if needed).
     * @param {chrome.tabs.Tab} currentTab The currently active user tab.
     * @param {Object} requiredViewportSize required width/height of the viewport.
     * @return {Promise} A promise which resolves once we finish preparing the window, or rejects if we failed to set
     *                  the required size.
     * @private
     */
    Applitools_._prepareWindowForTests = function (currentTab, requiredViewportSize) {
        var deferred = RSVP.defer();

        var originalTabIndex = currentTab.index;
        chrome.windows.get(currentTab.windowId, {populate: true}, function (originalWindow) {
            var originalTabsCount = originalWindow.tabs.length;
            var originalWindowWidth = originalWindow.width;
            var originalWindowHeight = originalWindow.height;

            var updatedWindowPromise;
            var isNewWindowCreated;
            if (originalTabsCount > 1) {
                // The window contains multiple tabs, so we'll move the current tab to a new window for
                // resizing.
                updatedWindowPromise = WindowHandler.moveTabToNewWindow(currentTab, requiredViewportSize);
                isNewWindowCreated = true;
            } else {
                // The window only contains the current tab, so we'll just resize the current window.
                updatedWindowPromise = RSVP.resolve(originalWindow);
                isNewWindowCreated = false;
            }
            // Move the current tab to a new window, so not to resize all the user's tabs
            updatedWindowPromise.then(function (testWindow) {
                // Since the new window only includes a single tab.
                var testTab = testWindow.tabs[0];
                WindowHandler.setViewportSize(testWindow, testTab, requiredViewportSize).then(function (resizedWindow) {
                    var resizedTab = resizedWindow.tabs[0];
                    var preparedWindowData = {
                        updated: {tab: resizedTab, window: testWindow, isNewWindowCreated: isNewWindowCreated},
                        original: {window: originalWindow, tabIndex: originalTabIndex,
                            windowSize: {width: originalWindowWidth, height: originalWindowHeight}}
                    };
                    // Done!
                    deferred.resolve(preparedWindowData);
                }).catch(function (invalidSizeWindow) {
                    // There was a problem resizing the window, so return the tab to it's original status.
                    // The window contains a single tab (the one we wanted to resize).
                    var resizedTab = invalidSizeWindow.tabs[0];
                    var restoredWindowPromise = Applitools_._restoreTab(resizedTab, isNewWindowCreated,
                        invalidSizeWindow, originalWindow, originalTabIndex, {
                            width: originalWindowWidth,
                            height: originalWindowHeight
                        });
                    restoredWindowPromise.then(function () {
                        deferred.reject('Failed to set viewport size ' + requiredViewportSize.width
                            + 'x' + requiredViewportSize.height + ' (got ' + resizedTab.width
                            + 'x' + resizedTab.height + ' instead)');
                    });
                });
            });
        });

        return deferred.promise;
    };

    /**
     * Runs a test using the image, saves the result as a baseline, and removes the test from the tests list.
     * @param {Buffer} image The image to save as a baseline.
     * @param {Object} testParams The test parameters (e.g., app name, test name, etc.).
     * @returns {Promise} A promise which resolves when saving the image as baseline is done.
     * @private
     */
    Applitools_._saveImageAsBaseline = function (image, testParams) {
        var imageTestParams = Object.create(testParams);
        imageTestParams.saveFailedTests = true;
        imageTestParams.removeSession = true;
        return EyesHandler.testImage(imageTestParams, image, 'Image to be used as baseline', _userAuthHandler);
    };

    /**
     * Runs a test for a given tab.
     * @param taskScheduler A task scheduler for sequencing the screenshot taking.
     * @param {chrome.tabs.Tab} tabToTest The tab to run the test on.
     * @param testParams The parameters of the test as returned by {@code _getTestParameters}.
     * @return {Object} An object containing 2 promises: {@code screenshotTaken} and {@code testFinished}.
     */
    Applitools_._runTest = function (taskScheduler, tabToTest, testParams) {
        var screenshotTakenDeferred = RSVP.defer();
        var testFinishedDeferred = RSVP.defer();
        var forceFullPageScreenshot, batchName, shouldUseBatch;

        var title = tabToTest.title;


        Applitools_._testStarted(tabToTest.id, testParams.appName, testParams.testName).then(function () {
            // If we need to compare to a baseline image.
            if (Applitools_.isBaselineImageLoadingEnabled() && Applitools_.getShouldUseImageAsBaseline()) {
                return Applitools_._saveImageAsBaseline(_baselineImageHandler.getImage(), testParams);
            }
            return RSVP.resolve();
        }).then(function () {
            // Checking whether or not we need a full page screenshot, as well as setting batch if necessary.
            return ConfigurationStore.getTakeFullPageScreenshot().then(function (forceFullPageScreenshot_) {
                forceFullPageScreenshot = forceFullPageScreenshot_;
            });
        }).then(function () {
            return ConfigurationStore.getBatchName().then(function (batchName_) {
                batchName = batchName_;
            });
        }).then(function () {
            return ConfigurationStore.getShouldUseBatch().then(function (shouldUseBatch_) {
                shouldUseBatch = shouldUseBatch_;
            });
        }).then(function () {
            if (shouldUseBatch && batchName) {
                testParams.batch = {
                    name: batchName,
                    id: Applitools_.currentState.batchId
                };

                // When working with a steps file, the tag name is the same as the test name (i.e., the current step
                // from the file). Also, we only want to use that when the batch panel is open.
                if (_stepsHandler !== undefined) {
                    title = testParams.testName;
                }
            }
        }).then(function () {
            return ConfigurationStore.getRemoveScrollBars();
        }).then(function (removeScrollBars) {
            // Get a screenshot of the given tab as PNG. We must run this using the task scheduler,
            // since the screenshot must be taken when the tab is active.
            var screenshotTask = new JSUtils.ScheduledTask(WindowHandler.getScreenshot,
                [tabToTest, forceFullPageScreenshot, removeScrollBars, testParams.viewportSize, false]);
            return taskScheduler.addTask(screenshotTask);
        }).then(function (image) {
            // We got the image, so resolve the relevant deferred
            screenshotTakenDeferred.resolve();

            // Run the test
            EyesHandler.testImage(testParams, image, title, _userAuthHandler)
                .then(function (testResults) {
                    testFinishedDeferred.resolve(testResults);
                }).catch(function () {
                    testFinishedDeferred.reject();
                }).finally(function () {
                    Applitools_._testEnded(testParams.appName, testParams.testName);
                });
        }).catch(function (err) {
            screenshotTakenDeferred.reject();
            testFinishedDeferred.reject(err);
            Applitools_._testEnded(testParams.appName, testParams.testName);
        });

        return {screenshotTaken: screenshotTakenDeferred.promise, testFinished: testFinishedDeferred.promise};
    };

    /**
     * Shows the test's results if necessary (might use an existing tab).
     * @param {Object} testResults The test's results as returned by {@code eyes.close}.
     * @param {Object} testParams The test's parameters as returned by {@code _getTestParameters}.
     * @param {chrome.windows.Window} testWindow The window to which the tested tab belongs to.
     * @return {Promise} A promise which resolves when the test results presentation is ready.
     * @private
     */
    Applitools_._handleTestResults = function (testResults, testParams, testWindow) {
        var deferred = RSVP.defer();
        var resultsUrl, shouldUseBatch;

        ConfigurationStore.getShouldUseBatch().then(function (shouldUseBatch_) {
            shouldUseBatch = shouldUseBatch_;
            ConfigurationStore.getEyesServerUrl().then(function (resultsServer) {
                // We want to use the results server as the prefix for the url
                var urlSessionPart = testResults.url.split("/app")[1];
                resultsUrl = resultsServer + "/app" + urlSessionPart;
                ConfigurationStore.getNewTabForResults()
                    .then(function (shouldOpen) {
                        if (shouldOpen) {
                                // If we're in steps mode, we want to open the results always in the same tab.
                            if (shouldUseBatch && _stepsHandler) {
                                // If such a tab already exists (or existed).
                                if (_stepsResultsTabId) {
                                    chrome.tabs.update(_stepsResultsTabId, {url: resultsUrl},
                                        function (tab) {
                                            if (tab) {
                                                deferred.resolve(tab);
                                            } else {
                                                // If the user closed the tab
                                                chrome.tabs.create({
                                                    windowId: testWindow.id,
                                                    url: resultsUrl,
                                                    active: false
                                                }, function (tab) {
                                                    if (tab) {
                                                        _stepsResultsTabId = tab.id;
                                                    }
                                                    deferred.resolve(tab);
                                                });
                                            }
                                        });
                                } else {
                                    // No tab for the steps results exists.
                                    chrome.tabs.create({
                                        windowId: testWindow.id,
                                        url: resultsUrl,
                                        active: false
                                    }, function (tab) {
                                        if (tab) {
                                            _stepsResultsTabId = tab.id;
                                        }
                                        deferred.resolve(tab);
                                    });
                                }
                            } else {
                                var baselineId = JSON.stringify(testParams),
                                    tabId = _resultTabs[baselineId];

                                // FIXME Daniel - replace chrome.tabs.create with ChromeUtils.createTab

                                if (tabId) {
                                    // This baseline already had a result tab. If it's open
                                    // we will reuse it
                                    chrome.tabs.update(tabId, {url: resultsUrl},
                                        function (tab) {
                                            if (tab) {
                                                deferred.resolve(tab);
                                            } else {
                                                // If the user closed the tab
                                                chrome.tabs.create({
                                                    windowId: testWindow.id,
                                                    url: resultsUrl,
                                                    active: false
                                                }, function (tab) {
                                                    if (tab) {
                                                        _resultTabs[baselineId] = tab.id;
                                                    }
                                                    deferred.resolve(tab);
                                                });
                                            }
                                        });
                                } else {
                                    // If there was no previous tab open for the results of the test.
                                    chrome.tabs.create({
                                        windowId: testWindow.id,
                                        url: resultsUrl,
                                        active: false
                                    }, function (tab) {
                                        if (tab) {
                                            _resultTabs[baselineId] = tab.id;
                                        }
                                        deferred.resolve(tab);
                                    });
                                }
                            }
                        } else {
                            // No need to open a tab for showing the results.
                            deferred.resolve(null);
                        }
                    });
            });
        });
        return deferred.promise;
    };

    /**
     * Tests the current tab.
     * @return {Object} An object containing 3 promises: {@code screenshotTaken}, {@code testFinished},
     *              {@code resultsHandled}. If an error occurred, the function rejects.
     */
    Applitools_.runSingleTest = function () {
        var shouldUseBatch;
        var preparedWindowData, currentTab, testParams, appName, testName;
        return ChromeUtils.getCurrentTab().then(function (currentTab_) {
            currentTab = currentTab_;
        }).then(function () {
            return ConfigurationStore.getShouldUseBatch();
        }).then(function (shouldUseBatch_) {
            shouldUseBatch = shouldUseBatch_;
            return Applitools_._getTestParameters(currentTab.url, false);
        }).then(function (testParams_) {
            testParams = testParams_;
            appName = testParams.appName;
            testName = testParams.testName;
            var testParamsLogMessage = Applitools_._buildLogMessage(appName, testName, 'Got tests parameters');
            Applitools_._log(testParamsLogMessage);
        }, function (err) {
            return Applitools_._onError('Failed to extract test parameters: ' + err, undefined, undefined)
                .then(function () {
                    return RSVP.reject();
                });
        }).then(function () {
            return Applitools_._prepareWindowForTests(currentTab, testParams.viewportSize);
        }).then(function (preparedWindowData_) {
            preparedWindowData = preparedWindowData_;
            // Give the resized window time to stabilize.
            return JSUtils.sleep(1000);
        }).then(function () {
            var taskScheduler = new JSUtils.SequentialTaskRunner();
            return Applitools_._runTest(taskScheduler, preparedWindowData.updated.tab, testParams);
        }).then(function (testPromises) {
            var tabRestoredPromise =
                testPromises.screenshotTaken.then(function () {
                    // If we're in "steps" mode (and the batch panel is open), we move on to the next step.
                    if (shouldUseBatch) {
                        return Applitools_.moveToNextStep();
                    }
                }).then(function () {
                    return Applitools_._restoreTab(preparedWindowData.updated.tab,
                        preparedWindowData.updated.isNewWindowCreated,
                        preparedWindowData.updated.window,
                        preparedWindowData.original.window,
                        preparedWindowData.original.tabIndex,
                        preparedWindowData.original.windowSize);
                });
            // Adding another promise for when the test results is handled.
            testPromises.resultsHandled =
                RSVP.all([tabRestoredPromise, testPromises.testFinished]).then(function (results) {
                    // TODO Daniel - find a better place to delete the tab
                    // Remove the current tab from our active tab list
                    delete _testTabs[currentTab.id];

                    var testResults = results[1];
                    return Applitools_._handleTestResults(testResults, testParams, preparedWindowData.original.window);
                });
            return testPromises;
        }).catch(function () {
            return Applitools_._onError('Failed to run test', appName, testName);
        });
    };

    /**
     * Gets the URLs to crawl from the given tab.
     * @param {chrome.tabs.Tab} tab The current tab, from which we will extract the links to crawl.
     * @return {Promise} A promise which resolves to the links to crawl, or rejects if failed to get the links.
     * @private
     */
    Applitools_._getUrlsToCrawl = function (tab) {
        var tabUrl = tab.url;

        // Get the sitemap's url.
        var domainRegexResult = /(https?:\/\/[\w.\-]+)(?:\/|\?|$)/.exec(tabUrl);
        if (!domainRegexResult || domainRegexResult.length < 2 || !domainRegexResult[1]) {
            return RSVP.reject("Failed to extract sitemap URL from current URL: " + tabUrl);
        }

        var sitemapUrl = domainRegexResult[1] + "/sitemap.xml";

        // Get the sitemap actually.
        return JSUtils.ajaxGet(sitemapUrl, 5000, true).then(function (sitemap) {
            if (!sitemap) {
                return RSVP.reject("Failed to extract sitemap from: " + sitemapUrl);
            }
            var urlsToCrawl = [];
            var urlElements = sitemap.getElementsByTagName("loc");
            //noinspection JSLint
            for (var i = 0; i < urlElements.length; ++i) {
                var currentLink = urlElements[i].innerHTML;
                if (currentLink) {
                    urlsToCrawl.push(currentLink)
                }
            }

            return RSVP.resolve(urlsToCrawl);
        });
    };

    //noinspection JSValidateJSDoc
    /**
     * Runs a test for a crawled link.
     * @param taskScheduler A task scheduler for sequencing the screenshot taking.
     * @param {chrome.tabs.Tab|undefined} tab The tab in which to run the test.
     * @param {Array} urlsToCrawl A list of urls to crawl.
     * @param {Object} baseTestParameters The test parameters (as returned from a call to {@code _getTestParameters})
     *                                      from which the current test parameters can be deduced.
     * @param {deferred} tabDoneDeferred A deferred which will be resolved when there are no more tests to run in the
     *                                      given tab.
     * @return {Promise} A promise which resolves to an object containing the tab and the test promises as returned
     *                   by {@code _runTest}.
     * @private
     */
    Applitools_._runCrawledTest = function (taskScheduler, tab, urlsToCrawl, baseTestParameters, tabDoneDeferred) {
        var url = urlsToCrawl.shift();
        // If there are no more URLs to crawl, we can close the tab.
        if (url === undefined) {
            // Remove the tab from our active tabs list.
            delete _testTabs[tab.id];

            // Close the tab.
            return ChromeUtils.removeTab(tab.id).then(function () {
                tabDoneDeferred.resolve();
            });
        }
        // Get test parameters with the correct test name
        var testParams = Applitools_._cloneTestParams(baseTestParameters);

        return Applitools_._getDefaultTestName(url).then(function (defaultTestName) {
            testParams.testName = defaultTestName;
        }).then(function () {
            return ChromeUtils.loadUrl(tab.id, url).then(function () {
                // Give the page time to load.
                return JSUtils.sleep(_TAB_LOAD_TIME_MS);
            });
        }).then(function () {
            var testPromises = Applitools_._runTest(taskScheduler, tab, testParams);
            testPromises.screenshotTaken.then(function () {
                // Recursive, sort of.
                Applitools_._runCrawledTest(taskScheduler, tab, urlsToCrawl, baseTestParameters, tabDoneDeferred);
            });
            return {tab: tab, testPromises: testPromises};
        });
    };

    /**
     * Tests the current tab and crawls the website, testing each crawled page.
     * @return {Promise} A promise which resolves once all the tests are finished, or rejects if there was a failure.
     */
    Applitools_.crawl = function () {
        var originalTab, testParams, appName, testName, preparedWindowData;
        var currentTabScreenshotPromise;
        var urlsToCrawl;
        var shouldUseBaselineImageOrigValue;
        var taskRunner = new JSUtils.SequentialTaskRunner();

        // We start with testing the current tab.
        return ChromeUtils.getCurrentTab().then(function (currentTab_) {
            originalTab = currentTab_;
            return Applitools_._getTestParameters(originalTab.url, false);
        }).then(function (testParams_) {
            testParams = testParams_;
            appName = testParams.appName;
            testName = testParams.testName;
            var testParamsLogMessage = Applitools_._buildLogMessage(appName, testName, "Got tests parameters");
            Applitools_._log(testParamsLogMessage);

            // Crawled tests always runs in a new batch, so we give it default values (will be overriden by the
            // specific tests if necessary).
            Applitools_.resetBatchId();
            testParams.batch = {
                name: appName,
                id: Applitools_.currentState.batchId
            };
        }, function (err) {
            return Applitools_._onError('Failed to extract test parameters: ' + err, undefined, undefined)
                .then(function () {
                    return RSVP.reject();
                });
        }).then(function () {
            // For crawled tests we don't want to use a loaded baseline image.
            if (Applitools_.isImageAsBaselineLoaded()) {
                shouldUseBaselineImageOrigValue = Applitools_.getShouldUseImageAsBaseline();
                return Applitools_.setShouldUseImageAsBaseline(false);
            }
        }).then(function () {
            return Applitools_._prepareWindowForTests(originalTab, testParams.viewportSize);
        }).then(function (preparedWindowData_) {
            preparedWindowData = preparedWindowData_;
            // Give the resized window time to stabilize.
            return JSUtils.sleep(1000);
        }).then(function () {
            return Applitools_._runTest(taskRunner, preparedWindowData.updated.tab, testParams);
        }).then(function (testPromises) {
            currentTabScreenshotPromise = testPromises.screenshotTaken;
        }).then(function () { //** Crawling
            return Applitools_._getUrlsToCrawl(preparedWindowData.updated.tab);
        }).then(function (urlsToCrawl_) {
            urlsToCrawl = urlsToCrawl_;
            // We want to go over the pages in a sorted order.
            urlsToCrawl.sort();
            for (var i = 0; i < urlsToCrawl.length; ++i) {
                // Remove duplicate URLs (e.g., if the one of the crawled URLs is the same as the original URL).
                if (originalTab.url === urlsToCrawl[i]
                    || (i > 0 && urlsToCrawl[i] === urlsToCrawl[i - 1])) {
                    urlsToCrawl.splice(i, 1);
                }
            }
        }).then(function () {
            // We use an internal function to create a context for every loop iteration below.
            function _startTest(windowId, urlsToCrawl_, testParams_, tabDoneDeferred_) {
                ChromeUtils.createTab(undefined, windowId, false).then(function (tab) {
                    Applitools_._runCrawledTest(taskRunner, tab, urlsToCrawl_, testParams_, tabDoneDeferred_);
                });
            }

            var tabsDonePromises = [];
            var tabsToOpen = Math.min(urlsToCrawl.length, _MAX_PARALLEL_CRAWLER_TABS);
            for (var i = 0; i < tabsToOpen; ++i) {
                var tabDoneDeferred = RSVP.defer();
                tabsDonePromises.push(tabDoneDeferred.promise);
                _startTest(preparedWindowData.updated.window.id, urlsToCrawl, testParams, tabDoneDeferred);
            }

            return RSVP.all(tabsDonePromises);
        }).then(function () {
            return currentTabScreenshotPromise;
        }).then(function () {
            if (Applitools_.isImageAsBaselineLoaded()) {
                Applitools_.setShouldUseImageAsBaseline(shouldUseBaselineImageOrigValue);
            }
        }).then(function () {
            return Applitools_._restoreTab(preparedWindowData.updated.tab,
                preparedWindowData.updated.isNewWindowCreated,
                preparedWindowData.updated.window,
                preparedWindowData.original.window,
                preparedWindowData.original.tabIndex,
                preparedWindowData.original.windowSize);
        });
    };

    return Applitools_;
}());

