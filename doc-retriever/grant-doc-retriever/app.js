const fs = require('fs');
const process = require('process');
const path = require('path');
const readline = require('readline');
const moment = require('moment');
const convert = require('xml-js');
const axios = require('axios');
const extract = require('extract-zip');
const AWS = require('aws-sdk');

const { initUtils, extractXmlFile, downloadFile, uploadFile } = require('../utils/utils');
// eslint-disable-next-line no-undef
const _TMP_DIR = path.resolve(__dirname, '..', 'tmp');

/* Init the utils dependencies */
initUtils(axios, extract, AWS);


/**
 * Extracts all the relative patent and sequence files and applications from
 * the Bulk XML file
 * @param {*} xmlFileName 
 */
async function processXmlFile(xmlFileName) {
    const fullFilePath = path.resolve(_TMP_DIR, xmlFileName);
    console.log(`Processing XML file ${fullFilePath}`);

    const readInterface = readline.createInterface({
        input: fs.createReadStream(fullFilePath),
        console: false
    });

    readInterface.on('error', function (err) {
        console.error(`Error occurred while reading XML file stream ${fullFilePath}`, err);
        throw err;
    });

    readInterface.on('close', function () {
        console.log(`Completed reading XML file stream ${fullFilePath}`);
    });

    let xmlString = '';
    let linesCount = 0;
    let parsedDocsCount = 0;
    let extractedDocsCount = 0;
    let skippedDocsCount = 0;
    let extractedSeqDocsCount = 0;
    for await (const line of readInterface) {
        linesCount++;
        if (line.startsWith('<?xml version=') && xmlString != '') {
            parsedDocsCount++;
            let result;
            try {
                result = convert.xml2json(xmlString, { compact: true, spaces: 0 });
                result = JSON.parse(result);
                if (result['sequence-cwu']) {
                    const docId = result['sequence-cwu']['publication-reference']['document-id']['doc-number']['_text'].replace(/^0+/, "");
                    await uploadFile(`seq/${docId}.xml`, xmlString);
                    extractedSeqDocsCount++;
                } else {
                    if (result['us-patent-grant']['us-bibliographic-data-grant']['classifications-ipcr']) {
                        let classifications = result['us-patent-grant']['us-bibliographic-data-grant']['classifications-ipcr']['classification-ipcr'];
                        let shouldUploadGrantFile = false;
                        if (classifications.length) {
                            shouldUploadGrantFile = classifications.some(c => c['section']['_text'] == 'A' || c['section']['_text'] == 'C');
                        } else {
                            shouldUploadGrantFile = classifications['section']['_text'] == 'A' || classifications['section']['_text'] == 'C';
                        }
                        if (shouldUploadGrantFile) {
                            const docId = result['us-patent-grant']['us-bibliographic-data-grant']['publication-reference']['document-id']['doc-number']['_text'].replace(/^0+/, "");
                            await uploadFile(`docs/${docId}.xml`, xmlString);
                            extractedDocsCount++;
                        } else {
                            skippedDocsCount++;
                        }
                    } else {
                        skippedDocsCount++;
                    }
                }
            } catch (err) {
                console.log(err, result, xmlString);
                skippedDocsCount++;
            } finally {
                xmlString = ''
            }
        }
        xmlString += line;
    }

    console.log(`Completed processing XML file ${fullFilePath}. 
    Total processed lines: ${linesCount}
    Total parsed docs: ${parsedDocsCount}
    Extracted docs: ${extractedDocsCount}
    Extracted seq docs: ${extractedSeqDocsCount}
    Skipped docs: ${skippedDocsCount}`);
}


/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format or the cloudwatch event
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
exports.lambdaHandler = async (event) => {
    console.debug('Handling event ', event);
    console.debug(`Current NODE_ENV = ${process.env.NODE_ENV}`);
    const startTime = Date.now();
    let fileDate;

    /*  Determine if the event is an API event or a CloudWatch 
        scheduled event. The API events contain the processing 
        date in the request body but scheduled events will 
        process the current week's file*/
    if (event.body) {
        const requestBody = JSON.parse(event.body);
        let year = requestBody.year;
        let week = requestBody.week;
        fileDate = moment().year(year).isoWeek(0).add(week, 'week').day('Tuesday');
    } else {
        fileDate = moment().day('Tuesday');
    }

    const compressedFileName = `ipg${fileDate.format('YYMMDD')}.zip`;
    const xmlFileName = `ipg${fileDate.format('YYMMDD')}.xml`;
    const fileDownloadUrl = `https://bulkdata.uspto.gov/data/patent/grant/redbook/fulltext/${fileDate.format('YYYY')}/ipg${fileDate.format('YYMMDD')}.zip`

    console.log(`Started processing grant file ${compressedFileName} for date ${fileDate.toDate()}`);

    await downloadFile(compressedFileName, fileDownloadUrl);
    await extractXmlFile(compressedFileName);
    await processXmlFile(xmlFileName);

    console.log(`Completed processing the grant file ${compressedFileName} for date ${fileDate.toDate()} in ${Date.now() - startTime} ms`);
    return new Promise((resolve) => { resolve('Done') });
}