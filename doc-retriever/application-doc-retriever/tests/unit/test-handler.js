'use strict';

const app = require('../../app.js');
const chai = require('chai');
const expect = chai.expect;
let event={}, context={};
const sinon = require('sinon');
const utils = require('../../utils/utils');
const fs = require('fs');
const axios = require('axios');
const  assert  = require('assert');

sinon.mock(utils);
sinon.mock(fs);
sinon.mock(axios);

describe('lambdaHandler tests', function () {
    it('first test', async () => {
        // TODO: Write real tests
        expect(1).to.eq(1);
    });
});
