//
// Copyright: Japannext Co., Ltd. <https://www.japannext.co.jp/>
// SPDX-License-Identifier: Apache-2.0
//

const pencilEmoji = "✏️"
exports.budgetAlert = (event, _context) => {

    const eventData = JSON.parse(Buffer.from(event.data, 'base64').toString());
    const alertType = (eventData.alertThresholdExceeded) ? 'A' : (eventData.forecastThresholdExceeded) ? 'F' : 'N';
    const threshold = Number(eventData.alertThresholdExceeded || eventData.forecastThresholdExceeded || 0);
    const costIntervalStart = new Date(eventData.costIntervalStart);
    let shouldUpdate = Boolean(true);

    if (!alertType) {
        console.log("Will not do anything for regular notices");
        return;
    }

    const fetch = require('node-fetch');
    const { Datastore } = require('@google-cloud/datastore');
    const datastore = new Datastore({ namespace: process.env.DATASTORE_NAMESPACE });
    const alertKind = 'budget-alerts';
    const webHookKind = 'webhooks';

    console.log(`Looking up webhooks for: ${event.attributes.budgetId}`);

    const webhookKeys = [
        datastore.key([webHookKind, event.attributes.budgetId]),
        datastore.key([webHookKind, '*']),
    ]

    const webHook = {
        url: false,
        key: false,
    }

    datastore.get(webhookKeys).then(([entities]) => {
        console.log(`found:${JSON.stringify(entities)}`);
        entities.forEach((entity) => {
            console.log(`forEach: key:${JSON.stringify(entity[datastore.KEY].name)} url:${JSON.stringify(entity.url)} webHook:${JSON.stringify(webHook.key)}`);
            if (entity) {
                if (entity[datastore.KEY].name == '*') {
                    if (!webHook.url) {
                        webHook.url = entity.url;
                        webHook.key = entity[datastore.KEY].name;
                    }
                }
                else {
                    webHook.url = entity.url;
                    webHook.key = entity[datastore.KEY].name;
                }
            }
        });

        if (!webHook.url) {
            throw ("ERRROR: Cannot find a webhook to notify!");
        }
        console.log(`Using webhooks from key:${webHook.key} url:${webHook.url}`);

        const post = {};
        const widgets = [];
        post.cardsV2 = [
            {
                cardId: "gcp-budget-notification",
                card: {
                    header: {
                    },
                    sections: [
                        {
                            widgets: widgets
                        }
                    ]
                }
            }
        ];

        if (alertType) {

            const alertKey = datastore.key([alertKind, `${event.attributes.budgetId}:${alertType}`]);
            console.log(`Working on alert: ${event.attributes.budgetId}:${alertType}=${threshold}.`);
            let theEntry = null;
            datastore.get(alertKey).then(([entry]) => {
                if (entry) {
                    if (entry.costIntervalStart - costIntervalStart >= 0) {
                        if (entry.threshold >= threshold) {
                            shouldUpdate = false;
                            console.log(`Reported previously, so skipping.`);
                        }
                    }
                    if (shouldUpdate) {
                        entry.costIntervalStart = costIntervalStart;
                        entry.threshold = threshold;
                    }
                    theEntry = entry;
                } else {
                    theEntry = {
                        key: alertKey,
                        data: [
                            { name: 'threshold', value: threshold, excludeFromIndexes: true },
                            { name: 'costIntervalStart', value: costIntervalStart, excludeFromIndexes: true },
                        ]
                    };
                }
            }).then(() => {
                if (shouldUpdate) {
                    post.cardsV2[0].card.header.title = `GCP Budget Notification for <b>${eventData.budgetDisplayName}</b>`;
                    switch (alertType) {
                        case 'N':
                            widgets.push({
                                decoratedText: {
                                    text: ""
                                        + `<font color="#008000">A new billing cycle started on the Google Cloud Platform.</font><br>`
                                        + `I will send notices here if the budget gets out of hand. `
                                        + `Please escalate if this is not the right place.`
                                        + ``
                                }
                            });
                            break;
                        case 'F':
                        case 'A':
                            post.text = "*Attention <users/all>!*";

                            widgets.push({
                                decoratedText: {
                                    topLabel: `BUDGET USAGE (${alertType == 'F' ? "FORECASTED" : "ACTUAL"})`,
                                    text: `${(parseFloat(eventData.budgetAmount) * threshold).toLocaleString()} ${eventData.currencyCode} (${ (threshold * 100).toFixed(0) }%)`,
                                    startIcon: { iconUrl: "https://www.gstatic.com/images/icons/material/system/2x/warning_grey600_48dp.png", },
                                }
                            });

                            break;
                    }
                    widgets.push({
                        decoratedText: {
                            topLabel: "Budget name",
                            text: eventData.budgetDisplayName,
                            startIcon: { knownIcon: "DESCRIPTION", },
                            button: {
                                text: pencilEmoji,

                                onClick: {
                                    openLink: {
                                        url: `https://console.cloud.google.com/billing/${event.attributes.billingAccountId}/budgets/${event.attributes.budgetId}/`,
                                    }
                                }
                            }
                        }
                    });
                    widgets.push({
                        decoratedText: {
                            topLabel: "Budgeted amount",
                            text: `${parseFloat(eventData.budgetAmount).toLocaleString()} ${eventData.currencyCode}`,
                            startIcon: { knownIcon: "DOLLAR", },
                        }
                    });

                    widgets.push({
                        decoratedText: {
                            topLabel: "Billing period start",
                            text: new Date(costIntervalStart).toISOString().substr(0, 10),
                            startIcon: { knownIcon: "INVITE", },
                        }
                    });
                    widgets.push({
                        decoratedText: {
                            topLabel: "Billing account",
                            text: event.attributes.billingAccountId,
                            startIcon: { iconUrl: "https://www.gstatic.com/images/icons/material/system/2x/account_balance_wallet_grey600_48dp.png", },
                            button: {
                                text: pencilEmoji,
                                onClick: {
                                    openLink: {
                                        url: `https://console.cloud.google.com/billing/${event.attributes.billingAccountId}/`,
                                    }
                                }
                            }
                        }
                    });

                    const webHookActions = new Array();
                    webHook.url.forEach(url => {
                        console.log(`Notifying ${url}`);
                        webHookActions.push(fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json; charset=UTF-8',
                            },
                            body: JSON.stringify(post),
                        }).then((response) => response.json()).then(
                            json => {
                                if (json.error) {
                                    return Promise.reject(json.error.message)
                                }
                            }
                        ).catch(err => {
                            throw new Error(err)
                        })
                        );
                    });
                    Promise.all(webHookActions).then(() => {
                        console.log("Updating the database");
                        datastore.save(theEntry);
                    }).catch((err) => {
                        console.log(`Problem while notifying: ${err}`)
                    });
                }
            });
        }
    }).catch((err) => {
        console.error(err);
    });

}
