.PHONY: help init clean test validate mock create delete info deploy
.DEFAULT_GOAL := help
environment = "inlined"
LOCAL_ENV :=local
TMP_DIR :=tmp

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: 	## install the nodejs dependencies
	cd ./doc-retriever && npm install && cd ./grant-doc-retriever/ && npm install

lint:	## run the eslint linter
	cd ./doc-retriever/grant-doc-retriever/ && npm run lint

test: ## run the unit tests
	cd ./doc-retriever/grant-doc-retriever/ && npm run test

local-invoke-grant: ## invokes the grants lambda handler directly on the host machine (local env)
	(set NODE_ENV=$(LOCAL_ENV) && set EFS_PATH=$(TMP_DIR) && node ./doc-retriever/grant-doc-retriever/tests/local/index.js)

local-invoke-application: ## invokes the application lambda handler directly on the host machine (local env)
	(set NODE_ENV=$(LOCAL_ENV) && set EFS_PATH=$(TMP_DIR) && node ./doc-retriever/application-doc-retriever/tests/local/index.js)

build-stack: ## builds the application using the SAM build command
	cd ./doc-retriever && sam build

deploy-stack: ## deploy the stack (Done in the CI pipeline)
	@echo done in github actions