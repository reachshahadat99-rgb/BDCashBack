// Polyfill TextEncoder / TextDecoder required by MSW in Node
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
