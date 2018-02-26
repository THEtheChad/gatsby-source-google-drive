'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadNodeContent = loadNodeContent;

var _api = require('./api');

var _api2 = _interopRequireDefault(_api);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var extensions = /jpeg|jpg|png|webp|tif|tiff/;
function isImage(node) {
  return extensions.test(node.mimeType);
}

async function loadNodeContent(node) {
  if (isImage(node)) {
    return _fs2.default.readFileSync(node.absolutePath);
  }

  return node.content;
}