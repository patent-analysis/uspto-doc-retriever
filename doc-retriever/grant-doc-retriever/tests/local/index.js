const app = require('../../app');
const event = require('../../../events/api_call_event.json');
const handler = app.lambdaHandler;
const start = Date.now();

console.log('Invoking the grants doc retriever handler directly on the host');
handler(event,{}).then(()=>{
    let end = Date.now();
    console.log('Local Invoke Complete in ' + (end - start) + ' ms')
})