const app = require('../../../application-doc-retriever/app');
const event = require('../../../events/api_call_event.json');
const handler = app.lambdaHandler;
const start = Date.now();

console.log('Invoking the application doc retriever handler directly on the host...');
handler(event,{}).then(()=>{
    let end = Date.now();
    console.log('Local Test Complete in ' + (end - start) + ' ms')
})