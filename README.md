# uspto-doc-retriever
A serverless function to download the patent grants and patent applications files from USPTO and stores it in AWS S3

### Getting started locally

Clone the repo
```
git clone git@github.com:patent-analysis/uspto-doc-retriever.git
cd uspto-doc-retriever
```

Install the dependencies

```
make install
```

Run the unit tests
```
make test
```

Invoke the function locally using a test payload defined in `doc-retriever/events/api_call_event.json`
```
make invoke-local-grant
make invoke-local-app
```

To build the SAM app (Done in the CI pipeline)
```
make build-stack
```