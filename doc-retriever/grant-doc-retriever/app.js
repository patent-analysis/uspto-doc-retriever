const axios = require('axios')
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');
const readline = require('readline');
const convert = require('xml-js');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});
const BUCKET_NAME = 'uspto-bulk-documents'
let response;
const tmpDir = path.resolve(__dirname, 'tmp');

async function downloadFile(fileDate) {
    console.log('attempting to download grant file for date', fileDate.format('YYYY-MM-DD'));
    const GRANTS_FILE_URL = `https://bulkdata.uspto.gov/data/patent/grant/redbook/fulltext/${fileDate.format('YYYY')}/ipg${fileDate.format('YYMMDD')}.zip`
    console.log('Connecting …')
    const { data, headers } = await axios({
        url: GRANTS_FILE_URL,
        method: 'GET',
        responseType: 'stream'
    })
    console.log('Starting download')

    if (!fs.existsSync('./tmp')) {
        fs.mkdirSync('./tmp');
    }
    if (!fs.existsSync('./tmp/docs')) {
        fs.mkdirSync('./tmp/docs');
    }
    if (!fs.existsSync('./tmp/seq')) {
        fs.mkdirSync('./tmp/seq');
    }
    const writer = fs.createWriteStream(
        path.resolve(__dirname, 'tmp', `ipg${fileDate.format('YYMMDD')}.zip`)
    )

   
    data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}


async function unpackFile(fileDate) {
    console.log('Extracting the zip file...')
    const zipFileName = path.resolve(tmpDir, `ipg${fileDate.format('YYMMDD')}.zip`);
    await extract(zipFileName, { dir: tmpDir })
    console.log('Extraction complete')
}

async function processFile() {
    const fileName = path.resolve(__dirname, 'tmp', `ipg${fileDate.format('YYMMDD')}.xml`);
    const readInterface = readline.createInterface({
        input: fs.createReadStream(fileName),
        console: false
    });

    let xmlString = '';
    readInterface.on('line', async function (line) {
        if (line.startsWith('<?xml version=') && xmlString) {
            var result = convert.xml2json(xmlString, { compact: true, spaces: 0 });
            result = JSON.parse(result);
            try {
                if (result['sequence-cwu']) {
                    const docId = result['sequence-cwu']['publication-reference']['document-id']['doc-number']['_text'].replace(/^0+/, "");
                    await uploadFile(`seq/${docId}.json`,JSON.stringify(result));
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
                      await uploadFile(`docs/${docId}.json`,JSON.stringify(result));
                        }
                    }
                }
            } catch (err) {
                console.log(err, result['us-patent-grant']['us-bibliographic-data-grant']['classifications-ipcr']);
            }
            xmlString = ''
        }
        xmlString += line;
    });

    return new Promise((resolve, reject) => {
        readInterface.on('error', function (err) {
            console.error(err);
            reject(err)
        });
        readInterface.on('end', function () {
            console.log('done reading processing the file');
            resolve()
        });
    })
}

async function uploadFile(key, content){
    const params = {
        Bucket: BUCKET_NAME,
        Key: key, // File name you want to save as in S3
        Body: content
    };
    return new Promise((resolve, reject)=>{
        s3.upload(params, function(err, data) {
            if (err) {
                reject(err);
                return;
            }
            resolve(data.Location);
        });
    });
}


/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
exports.lambdaHandler = async (event, context) => {
    console.debug('Handler Invoked with event', event);
    let processingTime;
    if (event.body) {
        const requestBody = JSON.parse(event.body);
        let year = requestBody.year;
        let week = requestBody.week;
        processingTime = moment().year(year).isoWeek(0).add(week, 'week').day('Tuesday');
    } else {
        processingTime = moment().day('Tuesday');
    }
    console.log('processing grant files for date', processingTime.toDate());
    await downloadFile(processingTime);
    await unpackFile(processingTime);
    await processFile(processingTime);
    console.log('completed processing grant file for date', processingTime.toDate());
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(response), 2000)
    });
}
