require('ts-node/register');

exports.config = {
  specs: [
    '../e2e/**/*.e2e-spec.ts'
  ],
  capabilities: {
    browserName: 'chrome'
  },
  directConnect: true,
  baseUrl: 'http://localhost:3000/',
  framework: 'mocha'
};
