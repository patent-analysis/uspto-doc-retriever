const fs = require('fs');
const process = require('process');
const path = require('path');
const readline = require('readline');
const moment = require('moment');
const convert = require('xml-js');
const axios = require('axios');
const extract = require('extract-zip');
const AWS = require('aws-sdk');

const { initUtils, extractXmlFile, downloadFile, uploadFile } = require('../grant-doc-retriever/utils/utils');
// eslint-disable-next-line no-undef
let EFS_PATH;
if (process.env.EFS_PATH) 
    EFS_PATH =  path.resolve(process.env.EFS_PATH.trim());
else
    EFS_PATH = path.resolve('tmp')

if (!fs.existsSync(EFS_PATH)) {
    fs.mkdirSync(EFS_PATH);
}

const _TMP_DIR = path.resolve(EFS_PATH, Date.now().toString());

/* Init the utils dependencies */
initUtils(axios, extract, AWS, _TMP_DIR);


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
    // TODO: UPDATE THIS SECTION TO LOOK AT APPLICATION'S data
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
                    if (result['us-patent-application']['us-bibliographic-data-application']['classifications-ipcr']) {
                        let classifications = result['us-patent-grant']['us-bibliographic-data-application']['classifications-ipcr']['classification-ipcr'];
                        let shouldUploadApplicationFile = false;
                        if (classifications.length) {
                            shouldUploadApplicationFile = classifications.some(c => c['section']['_text'] == 'A' || c['section']['_text'] == 'C');
                        } else {
                            shouldUploadApplicationFile = classifications['section']['_text'] == 'A' || classifications['section']['_text'] == 'C';
                        }
                        if (shouldUploadApplicationFile) {
                            const docId = result['us-patent-application']['us-bibliographic-data-application']['publication-reference']['document-id']['doc-number']['_text'].replace(/^0+/, "");
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
        fileDate = moment().year(year).isoWeek(0).add(week, 'week').day('Thursday');
    } else {
        fileDate = moment().day('Thursday');
    }

    const compressedFileName = `ipa${fileDate.format('YYMMDD')}.zip`;
    const xmlFileName = `ipa${fileDate.format('YYMMDD')}.xml`;
    const fileDownloadUrl = `https://bulkdata.uspto.gov/data/patent/application/redbook/fulltext/${fileDate.format('YYYY')}/ipa${fileDate.format('YYMMDD')}.zip`

    console.log(`Started processing application file ${compressedFileName} for date ${fileDate.toDate()}`);

    await downloadFile(compressedFileName, fileDownloadUrl);
    await extractXmlFile(compressedFileName);
    await processXmlFile(xmlFileName);


    console.log(`Deleting the tmp dir...`);
    fs.rmdirSync(_TMP_DIR, { recursive: true });
    console.log(`Completed processing the grant file ${compressedFileName} for date ${fileDate.toDate()} in ${Date.now() - startTime} ms`);
    return new Promise((resolve) => { resolve('Done') });
}
