gcp-budget-alert
----------------

Cloud function to listen to budget updates in Google Cloud Platform and notify on a Google Chat webhook.

Overview
------------

1. Google Cloud platofrm billing budget sends budget updates to a pub sub topic
2. This function subscribes to the topic, and when it sees an update it will:
   - Notify if this is the first message for this budget for the month
   - Notify if this is the first time a threshold is breached

Prerequisites
-------------

A working `gcloud` command, so you may want to install the Cloud SDK and make
sure `gcloud` command is authorized and working.

https://cloud.google.com/sdk/docs/install

A Google Cloud Platform project with the following enabled:
- Cloud Functions
- Datastore

Instructions
------------

Configure your budgets in the Google Cloud Platform console
(https://console.cloud.google.com/billing) as usual.

Configure each budget to "Conect a Pub/Sub topic to this budget". Best to keep
the topic in the GCP project you will use for this function.

Create a service account ("IAM & Admin" ⇒ "Service Accounts"), and download the
private key in JSON format as `private-key.json`).

Export some deployment time variables relevant to your configuration

```
export GCP_REGION=asia-northeast5
export GCP_PROJECT=my-project
export GCP_PUBSUB_TOPIC=my-topic
```

You may put these in an `.envrc` file if you are a https://github.com/direnv/direnv user.

Create the default budget notification webhook in each Datastore namespace you
intend to deploy the webhook to:

```
Kind: webhooks
Key: `name:*`
Properties:

Name: url
Type: Array
Value:
{
	"values": [
		{
			"stringValue": "https://chat.googleapis.com/v1/spaces/XXXX/messages?key=XXXXtoken=XXXX
		}
	]
}
```

You can configure multiple webhooks per entry, and you can configure a separate
set of webhooks for a budget if the key of the object is named like the budget
uuid.

Deploy the function with `make dev` or `make production` (there is no
functional difference between the two, but they would use different datastore
namespaces for their configuration).

Budget notifications come about every 15 minutes if there is any activity, so
you may have to be patient.
