'use strict';

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _changes = require('./changes');

var _changes2 = _interopRequireDefault(_changes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var emitter = new _events2.default();

var pageToken = void 0;

async function getInitialToken() {
  var res = await (0, _changes2.default)('getStartPageToken');
  pageToken = res.startPageToken;
}

async function getChanges() {
  if (!pageToken) await getInitialToken();

  var changes = [];
  var page = void 0;
  do {
    page = await (0, _changes2.default)('list', { pageToken: pageToken });
    pageToken = page.nextPageToken || page.newStartPageToken;
    changes = changes.concat(page.changes);
  } while (page.nextPageToken);

  return changes;
}

setInterval(async function () {
  var changes = await getChanges();
  changes.forEach(function (change) {
    return emitter.emit(change.type, change);
  });
  changes.forEach(function (change) {
    return emitter.emit('change', change);
  });
}, 5000);

module.exports = emitter;