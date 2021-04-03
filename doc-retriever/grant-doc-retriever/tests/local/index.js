const app = require('../../app');
const event = require('../../../events/api_call_event.json');
const handler = app.lambdaHandler;
const start = Date.now();

handler(event,{}).then(()=>{
    let end = Date.now();
    console.log('finished processing the file in ' + (end - start) + ' ms')
})