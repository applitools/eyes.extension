/**
 * Handling logic for the popup view of the extension.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var ConfigurationStore = require('./../ConfigurationStore.js'),
        RSVP = require('rsvp');

    //noinspection JSUnresolvedVariable,JSUnresolvedFunction
    var Applitools = chrome.extension.getBackgroundPage().Applitools;

    var _NOT_DISPLAYED_CLASS = "notDisplayed";


    /**
     * Sets the options for a select html element (options' values are also the options' texts).
     * @param selectElement The element for which to add the options.
     * @param optionValues The list of values to be used as options.
     * @param defaultValue
     * @return {Promise} A promise which resolves to the element when done setting the options.
     * @private
     */
    var _setSelect = function (selectElement, optionValues, defaultValue) {
        //noinspection JSLint
        for (var i=0; i<optionValues.length; ++i) {
            var currentValue = optionValues[i];

            // Initialize the option to be added
            var optionElement = document.createElement('option');
            optionElement.value = currentValue;
            optionElement.title = currentValue; // In case we shorten the text to fit into the select
            optionElement.innerText = currentValue;

            // If this is the default option, set it as such.
            if (currentValue === defaultValue) {
                optionElement.selected = 'selected';
            }

            selectElement.appendChild(optionElement);
        }
        return RSVP.resolve(selectElement);
    };

    /**
     * Initializes the options button with the required event listeners.
     * @return {Promise} A promise which resolves to the options element when the init is done.
     * @private
     */
    var _initOptionsButton = function () {
        var optionsElement = document.getElementById('options');

        // Open the options tab, or switch to it if it's already opened.
        optionsElement.addEventListener('click', function () {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            var optionsUrl = chrome.extension.getURL('options.html');

            //noinspection JSUnresolvedVariable
            chrome.tabs.query({url: optionsUrl}, function (tabs) {
                if (tabs.length) {
                    //noinspection JSUnresolvedVariable
                    chrome.tabs.update(tabs[0].id, {active: true});
                } else {
                    //noinspection JSUnresolvedVariable
                    chrome.tabs.create({url: optionsUrl});
                }
            });
        });

        return RSVP.resolve(optionsElement);
    };

    /**
     * Makes the requested panel displayed.
     * @param {string} panelId The ID of the panel to be displayed. Currently supported only 'mainPanel'
     *                          and 'baselinePanel'
     * @return {Promise} A promise which is resolved when the panel is set to be displayed.
     * @private
     */
    var _showPanel = function (panelId) {
        var mainPanel = document.getElementById('mainPanel');
        var baselinePanel = document.getElementById('baselinePanel');
        var panelToShow;
        if (panelId === 'baselinePanel') {
            panelToShow = baselinePanel;
            // Basically just display the baseline panel.
            baselinePanel.className = '';
            mainPanel.className = _NOT_DISPLAYED_CLASS;
        } else {
            // show main panel
            panelToShow = mainPanel;
            mainPanel.className = '';
            baselinePanel.className = _NOT_DISPLAYED_CLASS;
        }

        return RSVP.resolve(panelToShow);
    };

    /**
     * Handle user click on the baseline button in the main panel.
     * @return {Promise} A promise which resolves when done handling the click.
     * @private
     */
    var _onShowBaselineButtonClicked = function () {
        return _initBaselinePanel().then(function () {
            return _showPanel('baselinePanel');
        });
    };

    /**
     * Initializes the main panel's baseline button functionality
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initShowBaselinePanelButton = function () {
        var baselineButton = document.getElementById('showBaseline');
        baselineButton.addEventListener('click', _onShowBaselineButtonClicked);
        return RSVP.resolve(baselineButton);
    };

    /**
     * Handle user selection of a match level value.
     * @return {Promise} A promise which resolves to the user selected value when done handling the value change.
     * @private
     */
    var _onMatchLevelChanged = function () {
        var matchLevel = document.getElementById('matchLevel').value;
        return ConfigurationStore.setMatchLevel(matchLevel);
    };

    /**
     * Initializes the match level select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initMatchLevel = function () {
        var matchLevelElement = document.getElementById('matchLevel');

        // Get all available match levels.
        return ConfigurationStore.getAllMatchLevels().then(function (allMatchLevels) {
            // Get currently set match level
            return ConfigurationStore.getMatchLevel().then(function (matchLevel) {
                // Update the element.
                return _setSelect(matchLevelElement, allMatchLevels, matchLevel);
            }).then(function (initializedElement) {
                initializedElement.addEventListener('change', _onMatchLevelChanged);
                return RSVP.resolve(initializedElement);
            });
        });
    };

    /**
     * Handle user selection of a viewport size value.
     * @return {Promise} A promise which resolves to the user selected value when done handling the value change.
     * @private
     */
    var _onViewportSizeChanged = function () {
        var viewportSize = document.getElementById('viewportSize').value;
        return ConfigurationStore.setViewportSize(viewportSize);
    };

    /**
     * Initializes the viewport size select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initViewportSize = function () {
        var viewportSizeElement = document.getElementById('viewportSize');

        // Get all viewport sizes available.
        return ConfigurationStore.getAllViewportSizes().then(function (allViewportSizes) {
            // Get the currently set viewport size.
            return ConfigurationStore.getViewportSize().then(function (viewportSize) {
                // Update the element.
                return _setSelect(viewportSizeElement, allViewportSizes, viewportSize);
            }).then(function (initializedElement) {
                initializedElement.addEventListener('change', _onViewportSizeChanged);
                return RSVP.resolve(initializedElement);
            });
        });
    };

    /**
     * Initializes the run button with the required event listeners.
     * @return {Promise} A promise which resolves to the run element when the init is done.
     * @private
     */
    var _initRunButton = function () {
        var runElement = document.getElementById("run");
        // Run a visual test when button is clicked.
        runElement.addEventListener("click", function () {
            // IMPORTANT All test logic must run in the background page! This is because when the popup is closed,
            // the Javascript in the popup js file stops immediately, it does not wait for operations to complete.
            Applitools.runTest();
        });
        return RSVP.resolve(runElement);
    };

    /**
     * Initializes the elements on the main panel.
     * @return {Promise} A promise which resolves to an array containing the initialization results.
     * @private
     */
    var _initMainPanel = function () {
        return RSVP.all([_initOptionsButton(),
            _initShowBaselinePanelButton(),
            _initMatchLevel(),
            _initViewportSize(),
            _initRunButton()]
        );
    };

    // Shortcuts for getting DOM elements which are called often.
    var _getStepUrlInputElement = function () {
        return document.getElementById('stepUrl');
    };

    var _getStepUrlSelectionElement = function () {
        return document.getElementById('stepUrlSelection');
    };

    var _getAppNameInputElement = function () {
        return document.getElementById('appName');
    };

    var _getTestNameInputElement = function () {
        return document.getElementById('testName');
    };

    var _getUserValuesSelectionElement = function () {
        return document.getElementById('userValuesSelection');
    };

    var _getDefaultValuesSelectionElement = function () {
        return document.getElementById('defaultValuesSelection');
    };

    /**
     * Saves the changes the user performed on the baseline panel (if valid) and shows the main panel. If changes were
     * not valid, it will NOT switch back to the main panel.
     * @return {Promise} A promise which resolves when the changes are saved and the main panel is set to be shown,
 *                          or rejected if the user provided values are invalid.
     * @private
     */
    var _onBaselineOkayButtonClicked = function () {
        var stepUrl, appName, testName, selectionId;

        var stepUrlSelectionElement = _getStepUrlSelectionElement();
        stepUrl = _getStepUrlInputElement().value.trim();

        var userValuesSelectionElement = _getUserValuesSelectionElement();
        appName = _getAppNameInputElement().value;
        testName = _getTestNameInputElement().value;

        // TODO Daniel - Find a better way to handle validation of the values.
        if (stepUrlSelectionElement.checked) {
            if (!stepUrl) {
                return RSVP.reject(new Error('Invalid step URL'));
            }
            selectionId = stepUrlSelectionElement.id;
        } else if (userValuesSelectionElement.checked) {
            if (!appName.trim() && !testName.trim()) {
                return RSVP.reject(new Error('Invalid application/test name'));
            }
            selectionId = userValuesSelectionElement.id;
        }

        return ConfigurationStore.setBaselineSelection(selectionId)
            .then(function () {
                return ConfigurationStore.setBaselineStepUrl(stepUrl);
            }).then(function () {
                return ConfigurationStore.setBaselineAppName(appName);
            }).then(function () {
                return ConfigurationStore.setBaselineTestName(testName);
            }).then(function () {
                return _showPanel('mainPanel');
            });
    };

    /**
     * Ignores all changes the user performed in the baseline panel, and shows the main panel.
     * @return {Promise} A promise which is resolved when the main panel is shown.
     * @private
     */
    var _onBaselineCancelButtonClicked = function () {
        // Reset the user selection to the last values
        return _initUserSelection().then(function () {
            return _showPanel('mainPanel');
        });
    };

    /**
     * Handle user change of the step url input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineStepUrlClicked = function () {
        _getStepUrlSelectionElement().checked = true;
        return RSVP.resolve(_getStepUrlInputElement());
    };

    /**
     * Handle user change of the application name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineAppNameClicked = function () {
        _getUserValuesSelectionElement().checked = true;
        return RSVP.resolve(_getAppNameInputElement());
    };

    /**
     * Handle user change of the test name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineTestNameClicked = function () {
        _getUserValuesSelectionElement().checked = true;
        return RSVP.resolve(_getTestNameInputElement());
    };

    /**
     * Initializes the user selection elements (which one is selected, and the current value, if exists).
     * @return {Promise} A promise which resolves to the checked element initialization is done.
     * @private
     */
    var _initUserSelection = function () {

        var stepUrlInput = _getStepUrlInputElement();
        var appNameInput = _getAppNameInputElement();
        var testNameInput = _getTestNameInputElement();

        // Load values from storage
        return ConfigurationStore.getBaselineStepUrl().then(function (stepUrl) {
            stepUrlInput.value = stepUrl || '';
            stepUrlInput.addEventListener('click', _onBaselineStepUrlClicked);
            return ConfigurationStore.getBaselineAppName();
        }).then(function (appName) {
            appNameInput.value = appName || '';
            appNameInput.addEventListener('click', _onBaselineAppNameClicked);
            return ConfigurationStore.getBaselineTestName();
        }).then(function (testName) {
            testNameInput.value = testName || '';
            testNameInput.addEventListener('click', _onBaselineTestNameClicked);
            return ConfigurationStore.getBaselineSelection();
        }).then(function (selectionId) {
            // If we don't have a selection Id, we'll assume that the default is selected
            var checkedElement = selectionId ? document.getElementById(selectionId) :
                                                _getDefaultValuesSelectionElement();
            checkedElement.checked = true;
            return RSVP.resolve(checkedElement);
        });
    };

    /**
     * Initializes the baseline panel's "Cancel" button with the required listeners.
     * @return {Promise} A promise which resolves when the initialization is done.
     * @private
     */
    var _initBaselineCancelButton = function () {
        var cancelButton = document.getElementById('baselineCancel');
        cancelButton.addEventListener('click', _onBaselineCancelButtonClicked);
        return RSVP.resolve(cancelButton);
    };

    /**
     * Initializes the baseline panel's "OK" button with the required listeners.
     * @return {Promise} A promise which resolves when the initialization is done.
     * @private
     */
    var _initBaselineOkButton = function () {
        var okButton = document.getElementById('baselineOk');
        okButton.addEventListener('click', _onBaselineOkayButtonClicked);
        return RSVP.resolve(okButton);
    };

    /**
     * Initializes the elements on the baseline panel.
     * @return {Promise} A promise which resolves when all the baseline panel's elements are initialized.
     * @private
     */
    var _initBaselinePanel = function () {
        return RSVP.all([_initUserSelection(), _initBaselineOkButton(), _initBaselineCancelButton()]);
    };

    /**
     * Initializes the elements on the page.
     * @return {Promise} A promise which resolves to an array containing the initializations results.
     * @private
     */
    var _initPage = function () {
        return RSVP.all([_initMainPanel(), _initBaselinePanel()]);
    };

    document.addEventListener('DOMContentLoaded', _initPage);
}());
