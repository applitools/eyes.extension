/**
 * Handling logic for the popup view of the extension.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var ConfigurationStore = require('./../ConfigurationStore.js'),
        RSVP = require('rsvp');

    var Applitools = chrome.extension.getBackgroundPage().Applitools;

    var _NOT_DISPLAYED_CLASS = "notDisplayed",
        _INVALID_INPUT_CLASS = "invalidInput",
        _SELECTED_CLASS = "selected",
        _NOTIFICATION_ICON_CLASS = "notificationIcon";

    var _OPTIONS_ELEMENT_ID = "options",
        _MAIN_PANEL_ELEMENT_ID = "mainPanel",
        _BASELINE_PANEL_ELEMENT_ID = "baselinePanel",
        _SHOW_BASELINE_ELEMENT_ID = "showBaseline",
        _MATCH_LEVEL_ELEMENT_ID = "matchLevel",
        _VIEWPORT_SIZE_ELEMENT_ID = "viewportSize",
        _RUN_ELEMENT_ID = "run",
        _STEP_URL_ELEMENT_ID = "stepUrl",
        _STEP_URL_SELECTION_ELEMENT_ID = "stepUrlSelection",
        _APP_NAME_ELEMENT_ID = "appName",
        _TEST_NAME_ELEMENT_ID = "testName",
        _USER_VALUES_SELECTION_ELEMENT_ID = "userValuesSelection",
        _DEFAULT_VALUES_SELECTION_ELEMENT_ID = "defaultValuesSelection",
        _BASELINE_CANCEL_ELEMENT_ID = "baselineCancel",
        _BASELINE_OK_ELEMENT_ID = "baselineOk";

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
        var optionsElement = document.getElementById(_OPTIONS_ELEMENT_ID);

        Applitools.currentState.unreadErrorsExist ? optionsElement.classList.add(_NOTIFICATION_ICON_CLASS):
            optionsElement.classList.remove(_NOTIFICATION_ICON_CLASS);

        // Open the options tab, or switch to it if it's already opened.
        optionsElement.addEventListener('click', function () {
            var optionsUrl = chrome.extension.getURL('options.html');

            chrome.tabs.query({url: optionsUrl}, function (tabs) {
                if (tabs.length) {
                    chrome.tabs.update(tabs[0].id, {active: true});
                } else {
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
        var mainPanel = document.getElementById(_MAIN_PANEL_ELEMENT_ID);
        var baselinePanel = document.getElementById(_BASELINE_PANEL_ELEMENT_ID);
        var panelToShow;
        if (panelId === _BASELINE_PANEL_ELEMENT_ID) {
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
            return _showPanel(_BASELINE_PANEL_ELEMENT_ID);
        });
    };

    /**
     * Initializes the main panel's baseline button functionality
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initShowBaselinePanelButton = function () {
        var baselineButton = document.getElementById(_SHOW_BASELINE_ELEMENT_ID);
        baselineButton.addEventListener('click', _onShowBaselineButtonClicked);

        return ConfigurationStore.getBaselineSelection().then(function (selection) {
            return _updateShowBaselinePanelButton(baselineButton, selection);
        });
    };

    var _updateShowBaselinePanelButton = function (baselineButton, selectionId) {
        // Checking if there's a non-default baseline selection - i.e. not undefined
        if (!selectionId || selectionId === _DEFAULT_VALUES_SELECTION_ELEMENT_ID) {
            baselineButton.classList.remove(_NOTIFICATION_ICON_CLASS);
            baselineButton.title = "Set a custom baseline";
            return RSVP.resolve(baselineButton);
        }

        baselineButton.classList.add(_NOTIFICATION_ICON_CLASS);
        return RSVP.all([ConfigurationStore.getBaselineStepUrl(),
            ConfigurationStore.getBaselineAppName(),
            ConfigurationStore.getBaselineTestName()])
            .then(function (baselineParams) {
                baselineButton.title = "(Custom baseline) " + ((selectionId === _STEP_URL_SELECTION_ELEMENT_ID) ?
                    ("Step URL: " + baselineParams[0]) :
                    ("Application name: \"" + baselineParams[1] + "\", test name: \"" + baselineParams[2]) + "\".");

                return RSVP.resolve(baselineButton);
            });
    };

    /**
     * Handle user selection of a match level value.
     * @return {Promise} A promise which resolves to the user selected value when done handling the value change.
     * @private
     */
    var _onMatchLevelChanged = function () {
        var matchLevel = document.getElementById(_MATCH_LEVEL_ELEMENT_ID).value;
        return ConfigurationStore.setMatchLevel(matchLevel);
    };

    /**
     * Initializes the match level select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initMatchLevel = function () {
        var matchLevelElement = document.getElementById(_MATCH_LEVEL_ELEMENT_ID);

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
        var viewportSize = document.getElementById(_VIEWPORT_SIZE_ELEMENT_ID).value;
        return ConfigurationStore.setViewportSize(viewportSize);
    };

    /**
     * Initializes the viewport size select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initViewportSize = function () {
        var viewportSizeElement = document.getElementById(_VIEWPORT_SIZE_ELEMENT_ID);

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
        var runElement = document.getElementById(_RUN_ELEMENT_ID);
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
        return document.getElementById(_STEP_URL_ELEMENT_ID);
    };

    var _getStepUrlSelectionElement = function () {
        return document.getElementById(_STEP_URL_SELECTION_ELEMENT_ID);
    };

    var _getAppNameInputElement = function () {
        return document.getElementById(_APP_NAME_ELEMENT_ID);
    };

    var _getTestNameInputElement = function () {
        return document.getElementById(_TEST_NAME_ELEMENT_ID);
    };

    var _getUserValuesSelectionElement = function () {
        return document.getElementById(_USER_VALUES_SELECTION_ELEMENT_ID);
    };

    var _getDefaultValuesSelectionElement = function () {
        return document.getElementById(_DEFAULT_VALUES_SELECTION_ELEMENT_ID);
    };

    var _getDefaultValuesSelectionContainer = function () {
        return document.getElementsByClassName('defaultValuesContainer')[0];
    };

    /**
     * Highlight the given input to notify the user that the value input is invalid.
     * @param inputElement The input element to highlight.
     * @return {Promise} A promise which resolves when the highlighting is finished.
     * @private
     */
    var _highlightInvalidInput = function (inputElement) {
        inputElement.classList.add(_INVALID_INPUT_CLASS);
        var deferred = RSVP.defer();
        setTimeout(function () {
            inputElement.classList.remove(_INVALID_INPUT_CLASS);
            deferred.resolve();
        },500);
        return deferred.promise;
    };

    /**
     * Saves the changes the user performed on the baseline panel (if valid) and shows the main panel. If changes were
     * not valid, it will NOT switch back to the main panel.
     * @return {Promise} A promise which resolves when the changes are saved and the main panel is set to be shown,
     *                   or rejected if the user provided values are invalid.
     * @private
     */
    var _onBaselineOkayButtonClicked = function () {
        var stepUrl, appName, testName, selectionId;

        var stepUrlSelectionElement = _getStepUrlSelectionElement();
        stepUrl = _getStepUrlInputElement().value.trim();

        var userValuesSelectionElement = _getUserValuesSelectionElement();
        appName = _getAppNameInputElement().value;
        testName = _getTestNameInputElement().value;

        // For the selected type of input we want to make sure values are valid.
        if (stepUrlSelectionElement.checked) {
            if (!stepUrl || !Applitools.extractStepUrlParameters(stepUrl)) {
                return _highlightInvalidInput(_getStepUrlInputElement()).then(function () {
                    return RSVP.reject(new Error('Invalid step URL: ' + stepUrl));
                });
            }
            selectionId = stepUrlSelectionElement.id;
        } else if (userValuesSelectionElement.checked) {
            var rejectedUserValuesPromise = RSVP.resolve();
            var invalidUserValuesFound = false;
            if (!appName.trim()) {
                invalidUserValuesFound = true;
                rejectedUserValuesPromise = rejectedUserValuesPromise.then(function () {
                    _highlightInvalidInput(_getAppNameInputElement());
                });
            }
            if (!testName.trim()) {
                invalidUserValuesFound = true;
                rejectedUserValuesPromise = rejectedUserValuesPromise.then(function () {
                    _highlightInvalidInput(_getTestNameInputElement());
                });
            }
            if (invalidUserValuesFound) {
                rejectedUserValuesPromise = rejectedUserValuesPromise.then(function () {
                    return RSVP.reject(new Error('Invalid application/test name'));
                });
                return rejectedUserValuesPromise;
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
                var baselineButton = document.getElementById(_SHOW_BASELINE_ELEMENT_ID);
                return _updateShowBaselinePanelButton(baselineButton, selectionId);
            }).then(function () {
                return _showPanel(_MAIN_PANEL_ELEMENT_ID);
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
            return _showPanel(_MAIN_PANEL_ELEMENT_ID);
        });
    };

    /**
     * Updates styling for the now unselected elements.
     * @param elements The list of elements update.
     * @private
     */
    var _onInputElementsUnSelected = function (elements) {
        for (var i=0; i<elements.length; ++i) {
            var currentElement = elements[i];
            currentElement.classList.remove(_SELECTED_CLASS);
        }
    };

    /**
     * Updates styling for selected input elements.
     * @param elements The list of elements to update.
     * @private
     */
    var _onInputElementsSelected = function (elements) {
        for (var i=0; i<elements.length; ++i) {
            var currentElement = elements[i];
            if (!currentElement.contains(_SELECTED_CLASS)) {
                currentElement.classList.add(_SELECTED_CLASS);
            }
        }
    };

    /**
     * Handle user change of the step url input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineStepUrlSelected = function () {
        _getStepUrlSelectionElement().checked = true;
        _onInputElementsSelected([_getStepUrlInputElement()]);
        _onInputElementsUnSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        return RSVP.resolve(_getStepUrlInputElement());
    };

    /**
     * Handle user change of the application name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineAppNameSelected = function () {
        _getUserValuesSelectionElement().checked = true;
        _onInputElementsSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        _onInputElementsUnSelected([_getStepUrlInputElement()]);
        return RSVP.resolve(_getAppNameInputElement());
    };

    /**
     * Handle user change of the test name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineTestNameSelected = function () {
        _getUserValuesSelectionElement().checked = true;
        _onInputElementsSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        _onInputElementsUnSelected([_getStepUrlInputElement()]);
        return RSVP.resolve(_getTestNameInputElement());
    };

    /**
     * Handles user focus on the default values selection.
     * @return {Promise} A promise which resolves to the default values selection container.
     * @private
     */
    var _onBaselineDefaultSelectionSelected = function () {
        _getDefaultValuesSelectionElement().checked = true;
        _onInputElementsUnSelected([_getStepUrlInputElement(), _getAppNameInputElement(), _getTestNameInputElement()]);
        return RSVP.resolve(_getDefaultValuesSelectionContainer());
    };

    //noinspection SpellCheckingInspection
    /**
     * Sets an event listener on an element which checks if the Return key was pressed. If so, it's as if the okay
     * button was clicked.
     * @param element The DOM element to set the listener on.
     * @private
     */
    var _makeOkayable = function (element) {
        // If the user pressed enter on one of the inputs
        element.addEventListener('keypress', function (event) {
            if (event.keyCode === 13) {
                _onBaselineOkayButtonClicked();
            }
        });
        return RSVP.resolve(element);
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
        var defaultValuesSelectionContainer = _getDefaultValuesSelectionContainer();

        // Load values from storage
        return ConfigurationStore.getBaselineStepUrl().then(function (stepUrl) {
            stepUrlInput.value = stepUrl || '';
            stepUrlInput.addEventListener('click', _onBaselineStepUrlSelected);
            stepUrlInput.addEventListener('keypress', _onBaselineStepUrlSelected);
            return _makeOkayable(stepUrlInput).then(function () {
                return ConfigurationStore.getBaselineAppName();
            });
        }).then(function (appName) {
            appNameInput.value = appName || '';
            appNameInput.addEventListener('click', _onBaselineAppNameSelected);
            appNameInput.addEventListener('keypress', _onBaselineAppNameSelected);
            return _makeOkayable(appNameInput).then(function () {
                return ConfigurationStore.getBaselineTestName();
            });
        }).then(function (testName) {
            testNameInput.value = testName || '';
            testNameInput.addEventListener('click', _onBaselineTestNameSelected);
            testNameInput.addEventListener('keypress', _onBaselineTestNameSelected);
            return _makeOkayable(testNameInput).then(function() {
                return ConfigurationStore.getBaselineSelection();
            });
        }).then(function (selectionId) {
            // When clicking on the the radio buttons, we also want the input boxes to behave properly.
            _getDefaultValuesSelectionElement().addEventListener('click', _onBaselineDefaultSelectionSelected);
            _getStepUrlSelectionElement().addEventListener('click', _onBaselineStepUrlSelected);
            _getUserValuesSelectionElement().addEventListener('click', _onBaselineAppNameSelected);
            // Default values should be select also when we tab-moved into the default values container.
            defaultValuesSelectionContainer.addEventListener('focus', _onBaselineDefaultSelectionSelected);
            // Making the Selections acceptable by clicking "Return.
            return _makeOkayable(defaultValuesSelectionContainer).then(function () {
                return _makeOkayable(_getUserValuesSelectionElement()).then(function () {
                    return _makeOkayable(_getStepUrlSelectionElement()).then(function () {
                        // If we don't have a selection Id, we'll assume that the default is selected
                        var checkedElement = selectionId ? document.getElementById(selectionId) :
                            _getDefaultValuesSelectionElement();
                        var selectionPromise;
                        if (selectionId === 'userValuesSelection') {
                            selectionPromise = _onBaselineAppNameSelected();
                        } else if (selectionId === 'stepUrlSelection') {
                            selectionPromise = _onBaselineStepUrlSelected();
                        } else {
                            selectionPromise = _onBaselineDefaultSelectionSelected();
                        }
                        return selectionPromise.then(function () {
                            RSVP.resolve(checkedElement);
                        });
                    });
                });
            });
        });
    };

    /**
     * Initializes the baseline panel's "Cancel" button with the required listeners.
     * @return {Promise} A promise which resolves when the initialization is done.
     * @private
     */
    var _initBaselineCancelButton = function () {
        var cancelButton = document.getElementById(_BASELINE_CANCEL_ELEMENT_ID);
        cancelButton.addEventListener('click', _onBaselineCancelButtonClicked);
        return RSVP.resolve(cancelButton);
    };

    /**
     * Initializes the baseline panel's "OK" button with the required listeners.
     * @return {Promise} A promise which resolves when the initialization is done.
     * @private
     */
    var _initBaselineOkButton = function () {
        var okButton = document.getElementById(_BASELINE_OK_ELEMENT_ID);
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
     * Verifies that running a test is possible, and initializes the elements on the page.
     * @return {Promise} A promise which resolves to an array containing the initializations results.
     * @private
     */
    var _initPage = function () {
        return Applitools.prepareToTest().then(function () {
            return RSVP.all([_initMainPanel(), _initBaselinePanel(), Applitools.popupOpened()]);
        });
    };

    document.addEventListener('DOMContentLoaded', _initPage);
}());
