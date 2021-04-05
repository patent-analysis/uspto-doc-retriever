FROM public.ecr.aws/lambda/nodejs:14

COPY ./grant-doc-retriever/app.js ./grant-doc-retriever/package.json ./grant-doc-retriever/package-lock.json ./
COPY ./grant-doc-retriever/utils/utils.js ./utils/

RUN npm install

CMD ["app.lambdaHandler"]
