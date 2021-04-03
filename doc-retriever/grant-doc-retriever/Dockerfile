FROM public.ecr.aws/lambda/nodejs:14

COPY ./grant-doc-retriever/app.js ./grant-doc-retriever/utils/utils.js ./grant-doc-retriever/package.json ./grant-doc-retriever/package-lock.json ./

RUN npm install

# Command can be overwritten by providing a different command in the template directly.
CMD ["app.lambdaHandler"]
