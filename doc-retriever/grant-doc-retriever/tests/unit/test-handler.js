'use strict';

const app = require('../../app.js');
const chai = require('chai');
const expect = chai.expect;
let event={}, context={};
const sinon = require('sinon');
const utils = require('../../../utils/utils');
const fs = require('fs');
const axios = require('axios');
const  assert  = require('assert');

sinon.mock(utils);
sinon.mock(fs);
sinon.mock(axios);

describe('Tests index', function () {
    it('initial dummy test', async () => {
        assert.equal(1, 1);
        // TODO: Write real tests
    });
});
