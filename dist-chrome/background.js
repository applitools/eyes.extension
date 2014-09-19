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
            chrome.windows.get(originalWindowId, function (originalWindow) {
                Applitools_._getSelectedViewportSize().then(function (requiredViewportSize) {
                    // Move the current tab to a new window, so not to resize all the user's tabs
                    WindowHandler.moveTabToNewWindow(originalTab, requiredViewportSize).then(function (newWindow) {
                        // Since the new window only includes a single tab.
                        //noinspection JSUnresolvedVariable
                        var movedTab = newWindow.tabs[0];
                        WindowHandler.setViewportSize(newWindow, movedTab, requiredViewportSize).then(function (resizedWindow) {
                            //noinspection JSUnresolvedVariable
                            var resizedTab = resizedWindow.tabs[0];

                            var actualViewportSize = {width: resizedTab.width, height: resizedTab.height};

                            // Get a screenshot of the current tab as PNG.
                            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
                            chrome.tabs.captureVisibleTab({format: "png"}, function (imageDataUrl) {

                                WindowHandler.moveTabToExistingWindow(resizedTab, originalWindow, originalTabIndex,
                                    true)
                                    .then(function (restoredTab) {
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
                                                        requiredViewportSize)
                                                        .then(function (testResults) {
                                                            ConfigurationStore.getNewTabForResults()
                                                                .then(function (shouldOpen) {
                                                                    if (shouldOpen) {
                                                                        //noinspection JSUnresolvedVariable
                                                                        chrome.tabs.create({url: testResults.url, active: false},
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
                        });
                    });
                });
            });
            return deferred.promise;
        });
    };

    return Applitools_;
}());

