const axios = require('axios')
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');
const readline = require('readline');
let response;

async function downloadFile(fileDate) {
    console.log('I am looking for file date', fileDate.format('YYYY-MM-DD'));

    const GRANTS_FILE_URL = `https://bulkdata.uspto.gov/data/patent/grant/redbook/fulltext/${fileDate.format('YYYY')}/ipg${fileDate.format('YYMMDD')}.zip`
    console.log('Connecting …')
    const { data, headers } = await axios({
        url: GRANTS_FILE_URL,
        method: 'GET',
        responseType: 'stream'
    })
    const totalLength = headers['content-length']

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

    data.on('data', (chunk) => progressBar.tick(chunk.length))
    data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}


async function unpackFile(fileDate) {
    const fileLocation = path.resolve(__dirname, 'tmp', `ipg${fileDate.format('YYMMDD')}.zip`);
    const fileName = path.resolve(__dirname, 'tmp', `ipg${fileDate.format('YYMMDD')}.xml`);
    path.resolve(__dirname, 'tmp')

    await extract(fileLocation, { dir: path.resolve(__dirname, 'tmp') })
    console.log('Extraction complete')

    const readInterface = readline.createInterface({
        input: fs.createReadStream(fileName),
        console: false
    });
    
    let xmlString = '';
    readInterface.on('line', function (line) {
        if (line.startsWith('<?xml version=') && xmlString) {
            var convert = require('xml-js');
            var result = convert.xml2json(xmlString, { compact: true, spaces: 0 });
            try {

                result = JSON.parse(result);
                if (result['sequence-cwu']) {

                    const docId = result['sequence-cwu']['publication-reference']['document-id']['doc-number']['_text']
                    let path = path.resolve(__dirname, 'tmp', 'seq', `${docId}.json`);
                    fs.writeFileSync(path, JSON.stringify(result))
                } else {
                    if(!result['us-patent-grant']['us-bibliographic-data-grant']['classifications-ipcr']) {
                        // noop
                    } else{
                        let classifications = result['us-patent-grant']['us-bibliographic-data-grant']['classifications-ipcr']['classification-ipcr'];
                        let isCorrectClass = false;
                        if(classifications.length)
                            isCorrectClass= classifications.some(c => c['section']['_text'] == 'A' || c['section']['_text'] == 'C');
                        else
                            isCorrectClass= classifications['section']['_text'] == 'A' || classifications['section']['_text'] == 'C';
                        if(isCorrectClass){
                            const docId = result['us-patent-grant']['us-bibliographic-data-grant']['publication-reference']['document-id']['doc-number']['_text']
                            let path = path.resolve(__dirname, 'tmp', 'docs', `${docId}.json`);
                            fs.writeFileSync(path, JSON.stringify(result))
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

    return new Promise((resolve, reject)=>{
        readInterface.on('error', function (err) {
            console.error(err);
            reject(err)
        });
        readInterface.on('end', function (line) {
            console.log('done reading');
            resolve()
        });

    })
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
    console.log('Handler Invoked with event', event);
    return "ok";
    console.log('Handling event', JSON.stringify(event))
    const requestBody = JSON.parse(event.body);
    let year = requestBody.year;
    let week = requestBody.week;
    console.log(year, week)
    const fileDate = moment().year(year).isoWeek(0).add(week, 'week').day('Tuesday');
    // await downloadFile(fileDate)
    await unpackFile(fileDate)


    // US008062640B2
    // US009175093B2

    
    response = {
        'statusCode': 200,
        'body': JSON.stringify({
            message: 'hello world',
            // location: ret.data.trim()
        })
    }
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(response), 2000)
    });
}
