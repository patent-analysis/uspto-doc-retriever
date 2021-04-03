.PHONY: help init clean test validate mock create delete info deploy
.DEFAULT_GOAL := help
environment = "inlined"
LOCAL_ENV :=local

# TODO: Clean this file

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: 	## install the nodejs dependencies
	cd ./doc-retriever && npm install && cd ./grant-doc-retriever/ && npm install

lint:	## run the flake8 linter
	cd ./doc-retriever/grant-doc-retriever/ && npm run lint

test: ## run the unit tests
	cd ./doc-retriever/grant-doc-retriever/ && npm run test

local-invoke: ## invokes the lambda handler directly on the host machine (local env)
	(set NODE_ENV=$(LOCAL_ENV) && node ./doc-retriever/grant-doc-retriever/tests/local/index.js)
			
build-stack: ## builds the application (docker images)
	cd ./doc-retriever && sam build

deploy-stack: ## deploy the stack using AWS SAM
	@echo "done in github actions