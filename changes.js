'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _authDrive = require('./auth-drive');

var _authDrive2 = _interopRequireDefault(_authDrive);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = async function Changes(method) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var ctx = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : { attempts: 0 };

  var drive = await (0, _authDrive2.default)();

  return new Promise(function (resolve, reject) {
    function backoff() {
      if (++ctx.attempts > 7) {
        reject('Usage Limit Exceeded');
        return;
      }

      setTimeout(function () {
        var next = Changes(method, params, opts, ctx);
        resolve(next);
      }, Math.pow(2, ctx.attempts) * 200);
    }

    var request = drive.changes[method](params, opts, function (err, body) {
      if (!err) {
        return resolve(body);
      }

      if (err.code === 403) return backoff();

      reject(err);
    });
  });
};