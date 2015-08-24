/**
 * Encapsulates handling of an image to be used as a baseline.
 */
(function () {
    'use strict';

    var GeneralUtils = require('eyes.utils').GeneralUtils,
        ConfigurationStore = require('./ConfigurationStore.js');

    var UserAuthHandler = function () {
        this._APPLITOOLS_BACKWARDS_COMPATIBILITY_LOGIN_URL = 'https://www.applitools.com/login/';
        this._APPLITOOLS_ACCESS_DENIED_URL = undefined;
        this._APPLITOOLS_NEW_AUTH_URL = undefined;
        this.userAccounts = undefined; // The list of the user accounts received from the server.
        this.currentAccountIndex = -1; // The account selected by the user, defaults to the account marked as current
                                        // by the server.
        this.backwardsCompatibility = undefined; // An object which contains the backwards-compatible login data.
        this.userRedirectUrl = undefined; // The URL to redirect the user to, if we failed to load the credentials.
    };

    /**
     * @returns {Promise} A promise which resolves once the user credentials are loaded, or rejects if a failure
     * occurred.
     */
    UserAuthHandler.prototype.loadCredentials = function () {
        var currentAccountId;
        return new Promise(function (resolve, reject) {
            ConfigurationStore.getEyesServerUrl()
                .then(function (eyesServerUrl) {
                    //noinspection SpellCheckingInspection
                    this._APPLITOOLS_ACCESS_DENIED_URL = GeneralUtils.urlConcat(eyesServerUrl, '/app/accessdenied');
                }.bind(this)).then(function () {
                    return ConfigurationStore.getEyesApiServerUrl();
                }).then(function (eyesApiServerUrl) {
                    this._APPLITOOLS_NEW_AUTH_URL = GeneralUtils.urlConcat(eyesApiServerUrl, '/api/auth/authredirect');
                }.bind(this)).then(function () {
                    return ConfigurationStore.getCurrentAccountId();
                }).then(function (currentAccountId_) {
                    currentAccountId = currentAccountId_;
                }).then(function () {
                    return ConfigurationStore.getUserAccounts().then(function (accountsInfo) {
                        // If we're inside the resolve section, this means we're using the new auth scheme.
                        this.backwardsCompatibility = undefined;

                        if(!accountsInfo) {
                            this.userRedirectUrl = this._APPLITOOLS_NEW_AUTH_URL;
                            reject('Failed to load credentials: user is not logged in.');
                            return;
                        }

                        if (accountsInfo.length === 0) {
                            this.userRedirectUrl = this._APPLITOOLS_ACCESS_DENIED_URL;
                            reject('Failed to load credentials: user is not a member of any team.');
                            return;
                        }

                        this.currentAccountIndex = -1;
                        var defaultAccountIndex = 0; // The index provided by the server.
                        for (var i = 0; i < accountsInfo.length; ++i) {
                            // If the user selected an account before
                            if (currentAccountId && currentAccountId === accountsInfo[i].accountId) {
                                this.currentAccountIndex = i;
                                break;
                            }
                            if (accountsInfo[i].isCurrent) {
                                defaultAccountIndex = i;
                            }
                        }
                        var resultPromise = Promise.resolve();
                        // If we couldn't find the account previously selected by the user, we set account marked as
                        // "current" by the server to be the current account.
                        if (this.currentAccountIndex === -1) {
                            this.currentAccountIndex = defaultAccountIndex;
                            resultPromise = resultPromise.then(function() {
                                return ConfigurationStore.setCurrentAccountId(
                                    accountsInfo[defaultAccountIndex].accountId);
                            });
                        }
                        this.userAccounts = accountsInfo;
                        resultPromise.then(function () {
                            resolve(this);
                        }.bind(this));
                    }.bind(this), function () {
                        // Failed to load accounts for some reason, let's try the backwards compatible way.
                        this.userAccounts = undefined;
                        this.currentAccountIndex = -1;

                        var apiKey, accountId;
                        return ConfigurationStore.getApiKey()
                            .then(function (apiKey_) {
                                apiKey = apiKey_;
                                return ConfigurationStore.getAccountId();
                            }).then(function (accountId_) {
                                accountId = accountId_;
                            }).then(function () {
                                if (!apiKey || !accountId) {
                                    this.userRedirectUrl = this._APPLITOOLS_BACKWARDS_COMPATIBILITY_LOGIN_URL;
                                    reject('Failed to load credentials (old auth): user is not logged in.');
                                    return;
                                }
                                this.backwardsCompatibility = {apiKey: apiKey, accountId: accountId};
                                resolve(this);
                            }.bind(this));
                    }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    /**
     * @return {String} The URL to which redirect the user, when loading the user credentials failed.
     */
    UserAuthHandler.prototype.getUserCredentialsRedirectUrl = function () {
        return this.userRedirectUrl;
    };

    /**
     * @returns {Array} The list of user accounts loaded from the server.
     */
    UserAuthHandler.prototype.getUserAccounts = function () {
        return this.userAccounts;
    };

    /**
     * @returns {Promise} A promise which resolves to the user's current account ID.
     */
    UserAuthHandler.prototype.getCurrentAccountId = function () {
        return ConfigurationStore.getCurrentAccountId();
    };

    /**
     * @returns {Promise} A promise which resolves to the account index once the account is set, or rejects on failure.
     */
    UserAuthHandler.prototype.setCurrentAccountId = function (accountId) {
        return new Promise(function (resolve, reject) {
            // If we're not using the new authentication scheme
            if (!this.userAccounts) {
                reject('Failed to set current account: not using the new authentication scheme.');
                return;
            }

            var currentAccountIndex = -1;
            for (var i = 0; i < this.userAccounts.length; ++i) {
                if (accountId === this.userAccounts[i].accountId) {
                    currentAccountIndex = i;
                    break;
                }
            }

            // If we found the account
            if (currentAccountIndex !== -1) {
                ConfigurationStore.setCurrentAccountId(accountId).then(function () {
                    this.currentAccountIndex = currentAccountIndex;
                    resolve(this.currentAccountIndex);
                }.bind(this));
                return;
            }

            reject('Failed to set current account: failed to find account ID: ' + accountId);
        }.bind(this));
    };

    /**
     * @returns {Promise} A promise which resolves to an object of the form {runKey:  , isNewAuthScheme: }, where
     * {@code runKey} is a {@code string} and {@code isNewAuthScheme} is {@code boolean}. The promise rejects if no
     * credentials are loaded.
     */
    UserAuthHandler.prototype.getRunKey = function () {
        return new Promise(function (resolve, reject) {
            if (this.userAccounts) {
                var currentAccount = this.userAccounts[this.currentAccountIndex];
                resolve({runKey: currentAccount.runnerKey, isNewAuthScheme: true});
            } else if (this.backwardsCompatibility) {
                resolve({runKey: this.backwardsCompatibility.apiKey, isNewAuthScheme: false});
            } else {
                reject();
            }
        }.bind(this));
    };

    /**
     * @returns {Promise} A promise which resolves to an object of the form {name: , value} or to undefined. If it
     * resolves to an object then this is the object which should be used as a query parameter in the URL for viewing
     * tests. If no credentials are available, then the promise rejects.
     */
    UserAuthHandler.prototype.getResultsViewKey = function () {
        return new Promise(function (resolve, reject) {
            if (this.userAccounts) {
                var currentAccount = this.userAccounts[this.currentAccountIndex];
                resolve({name: 'accountId', value: currentAccount.accountId});
            } else if (this.backwardsCompatibility) {
                resolve(undefined);
            } else {
                reject();
            }
        }.bind(this));
    };

    /**
     * @returns {Promise} A promise which resolves to an object of the form {name: , value} or to undefined. If it
     * resolves to an object then this is the object which should be used as a query parameter in the URL for viewing
     * tests. If no credentials are available, then the promise rejects.
     */
    UserAuthHandler.prototype.getAccessKey = function () {
        return new Promise(function (resolve, reject) {
            if (this.userAccounts) {
                var currentAccount = this.userAccounts[this.currentAccountIndex];
                resolve({name: 'accessKey', value: currentAccount.accessKey});
            } else if (this.backwardsCompatibility) {
                resolve({name: 'apiKey', value: this.backwardsCompatibility.accountId});
            } else {
                reject();
            }
        }.bind(this));
    };



    module.exports = UserAuthHandler;
}());
