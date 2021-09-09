VERSION = $(shell git describe --always)
DEPLOYMENT_TIME = $(shell date -Is)
GOOGLE_APPLICATION_CREDENTIALS = private-key.json

dev: sanity
	gcloud functions deploy budget-alerts-$@ \
		--project $(GCP_PROJECT) \
		--region $(GCP_REGION) \
		--entry-point budgetAlert \
		--source . \
		--runtime=nodejs14 \
		--set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=$(GOOGLE_APPLICATION_CREDENTIALS) \
		--set-env-vars=DATASTORE_NAMESPACE=$@ \
		--set-env-vars=MY_VERSION="$(VERSION)" \
		--set-env-vars=MY_DEPLOYMENT_TIME="$(DEPLOYMENT_TIME)" \
		--memory=128M \
		--trigger-topic budget-alerts

rundev:
	env \
		GOOGLE_APPLICATION_CREDENTIALS=$(GOOGLE_APPLICATION_CREDENTIALS) \
		DATASTORE_NAMESPACE=dev \
		MY_VERSION="$(VERSION)" \
		MY_DEPLOYMENT_TIME="$(DEPLOYMENT_TIME)" \
		node -e 'gcf = require("./index.js"); event = require("./.ignore/msg-forecast.json"); gcf.budgetAlert(event)'

production: sanity
	gcloud functions deploy budget-alerts \
		--project $(GCP_PROJECT) \
		--region $(GCP_REGION) \
		--entry-point budgetAlert \
		--source . \
		--runtime=nodejs14 \
		--set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=$(GOOGLE_APPLICATION_CREDENTIALS) \
		--set-env-vars=DATASTORE_NAMESPACE=$@ \
		--set-env-vars=MY_VERSION="$(VERSION)" \
		--set-env-vars=MY_DEPLOYMENT_TIME="$(DEPLOYMENT_TIME)" \
		--memory=128M \
		--trigger-topic budget-alerts

sanity:
	@[ -z "$(GCP_PROJECT)" ] && echo "You should export GCP_PROJECT" && exit 1 || true
	@[ -z "$(GCP_REGION)" ] && echo "You should export GCP_REGION" && exit 1 || true

.PHONY: deploy sanity
