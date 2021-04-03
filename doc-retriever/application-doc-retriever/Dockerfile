FROM public.ecr.aws/lambda/nodejs:14

COPY ./application-doc-retriever/app.js ./grant-doc-retriever/package.json ./grant-doc-retriever/package-lock.json ./
COPY ./grant-doc-retriever/utils/utils.js ./grant-doc-retriever/utils/

RUN npm install

CMD ["app.lambdaHandler"]
