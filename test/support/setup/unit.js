const path = require('path');

const Microservice = require('@joinbox/loopback-microservice');
const Loopback = require('loopback');
const LoopbackRegistry = require('loopback/lib/registry');

module.exports = function({ env = process.env.NODE_ENV } = {}) {
  before(async function() {
    const appRootDir = path.resolve(__dirname, '../server');
    const options = {
      appRootDir,
      env,
    };
    // Reset the inside registry of loopback
    // TODO integrate this in Microservice lib ?
    Loopback.registry = new LoopbackRegistry();
    this.service = await Microservice.boot(options);
    this.models = this.service.app.models;
  });
}
