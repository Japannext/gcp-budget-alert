VERSION = $(shell git describe --always)
DEPLOYMENT_TIME = $(shell date -Is)
GOOGLE_APPLICATION_CREDENTIALS = private-key.json

ifeq ($(TRIGGER_TOPIC),)
TRIGGER_TOPIC := budget-alerts
endif

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
		--trigger-topic $(TRIGGER_TOPIC)

tests/msg-%.json: tests/data-%.json tests/event.json
	cat tests/event.json | sed -e "s/__DATA__/$$(base64 -w0 < $<)/" > $@+
	mv $@+ $@

runtest-%: tests/msg-%.json
	env \
		GOOGLE_APPLICATION_CREDENTIALS=$(GOOGLE_APPLICATION_CREDENTIALS) \
		DATASTORE_NAMESPACE=dev \
		MY_VERSION="$(VERSION)" \
		MY_DEPLOYMENT_TIME="$(DEPLOYMENT_TIME)" \
		node -e 'gcf = require("./index.js"); event = require("./$<"); gcf.budgetAlert(event)'

container:
	podman build -t test .

containertest-%: container
	podman run --rm test make $(patsubst containertest-%,runtest-%,$@)

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
		--trigger-topic $(TRIGGER_TOPIC)

sanity:
	@[ -z "$(GCP_PROJECT)" ] && echo "You should export GCP_PROJECT" && exit 1 || true
	@[ -z "$(GCP_REGION)" ] && echo "You should export GCP_REGION" && exit 1 || true

.PHONY: deploy sanity
