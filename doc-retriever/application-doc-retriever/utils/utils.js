const fs = require('fs');
const path = require('path');
let AWS;
let extract;
let axios;
let s3;
let _TMP_DIR;
const BUCKET_NAME = 'uspto-documents-storage'

/**
 * Initializes the Utils dependencies
 * @param {*} axiosLib 
 * @param {*} extractLib 
 * @param {*} AWSLib 
 */
const initUtils = (axiosLib, extractLib, AWSLib, tmpdir) => {
    axios = axiosLib;
    extract = extractLib;
    AWS = AWSLib;
    _TMP_DIR = tmpdir;
    s3 = new AWS.S3({ region: process.env.PSV_AWS_REGION });
}

/**
 * Unzips the compressed bulk data file
 * @param {*} compressedFileName 
 */
const extractXmlFile = async (compressedFileName) => {
    const fullFilePath = path.resolve(_TMP_DIR, compressedFileName);
    console.log(`Extracting the content of zip file ${fullFilePath}`)
    await extract(fullFilePath, { dir: _TMP_DIR })
    console.log('File extraction complete')
}

/**
 * Downloads the USPTO bulk data file
 * @param {*} compressedFileName 
 */
const downloadFile = async (compressedFileName, fileDownloadUrl) => {
    console.log(`Downloading USPTO file ${compressedFileName} from URL ${fileDownloadUrl}`);
    const startTime = Date.now();
    console.log('Connecting to the USPTO servers...')
    const { data } = await axios({
        url: fileDownloadUrl,
        method: 'GET',
        responseType: 'stream'
    })
    console.log('Downloading the file...');

    if (!fs.existsSync(_TMP_DIR)) {
        fs.mkdirSync(_TMP_DIR);
    }
    if (!fs.existsSync(path.resolve(_TMP_DIR, 'docs'))) {
        fs.mkdirSync(path.resolve(_TMP_DIR, 'docs'));
    }
    if (!fs.existsSync(path.resolve(_TMP_DIR, 'seq'))) {
        fs.mkdirSync(path.resolve(_TMP_DIR, 'seq'));
    }
    const writer = fs.createWriteStream(
        path.resolve(_TMP_DIR, compressedFileName)
    );

    data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log(`Downloaded file ${compressedFileName} in ${Date.now() - startTime} ms`);
            resolve();
        });
        writer.on('error', (e) => {
            console.error(`Downloading file ${compressedFileName} failed after ${Date.now() - startTime} ms.`, e);
            reject(e);
        })
    })
}


/**
 * Upload an XML file to the s3 storage buckets
 * When running locally, this will save the file
 * locally in a tmp directory
 * @param {*} key 
 * @param {*} content 
 */
async function uploadFile(key, content) {
    console.debug('Upload file called ', key)
    const env = process.env.NODE_ENV;
    if (env && env.trim() == 'local') {
        const tmpFilePath = path.resolve(_TMP_DIR, key);
        fs.writeFileSync(tmpFilePath, content);
        return;
    }
    const params = {
        Bucket: BUCKET_NAME,
        Key: key, // Dir + File name
        Body: content
    };
    return new Promise((resolve, reject) => {
        s3.upload(params, function (err, data) {
            if (err) {
                reject(err);
                return;
            } else {
                resolve(data.Location);
            }
        });
    });
}

function deleteTmpDir(dirName) {
    console.log(`Deleting tmp dir ${dirName} ...`);
    fs.rmdirSync(dirName, { recursive: true, maxRetries: 3, retryDelay: 1000 });
    console.log(`Deleted tmp dir ${dirName}`);
}

module.exports = { initUtils, extractXmlFile, downloadFile, uploadFile, deleteTmpDir }