FROM public.ecr.aws/lambda/nodejs:14

COPY ./application-doc-retriever/app.js ./application-doc-retriever/package.json ./application-doc-retriever/package-lock.json ./
COPY ./application-doc-retriever/utils/utils.js ./utils/

RUN npm install

CMD ["app.lambdaHandler"]
