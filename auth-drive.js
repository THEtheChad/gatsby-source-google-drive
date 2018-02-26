'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _readline = require('readline');

var _readline2 = _interopRequireDefault(_readline);

var _googleapis = require('googleapis');

var _googleapis2 = _interopRequireDefault(_googleapis);

var _nconf = require('nconf');

var _nconf2 = _interopRequireDefault(_nconf);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _util = require('util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var readFile = (0, _util.promisify)(_fs2.default.readFile);
var writeFile = (0, _util.promisify)(_fs2.default.writeFile);
var drive = _googleapis2.default.drive('v3');

_nconf2.default.env().required(['google_client_id', 'google_client_secret', 'google_redirect_uri']);

var client = {
  secret: _nconf2.default.get('google_client_secret'),
  id: _nconf2.default.get('google_client_id'),
  scope: ['https://www.googleapis.com/auth/drive.readonly']
};

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var CLIENT_HASH = _crypto2.default.createHash('md5').update(JSON.stringify(client)).digest('hex');
var TOKEN_DIR = _path2.default.resolve(_os2.default.homedir(), '.credentials');
var TOKEN_PATH = _path2.default.resolve(TOKEN_DIR, 'google-' + CLIENT_HASH + '.json');

async function authorize() {
  var oauth_client = new _googleapis2.default.auth.OAuth2(client.id, client.secret, _nconf2.default.get('google_redirect_uri'));

  try {
    var token = await readFile(TOKEN_PATH);
    oauth_client.credentials = JSON.parse(token);
  } catch (e) {
    await getNewToken(oauth_client);
  }

  // set auth as a global default
  _googleapis2.default.options({
    auth: oauth_client
  });

  // we need to do a dirty request to refresh
  // our auth token (bug with drive API)
  await new Promise(function (resolve, reject) {
    drive.files.list({}, function (err, res) {
      return resolve();
    });
  });
}

async function getNewToken(auth) {
  console.log('Welcome to Gatsby-Source-Google-Drive Plugin!');
  console.log('---------------------------------------------');
  console.log('(initial setup is required)');
  var auth_url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: client.scope
  });
  console.log('\nAuthorize this app by visiting:\n', auth_url);
  var rl = _readline2.default.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  await new Promise(function (resolve, reject) {
    rl.question('\nEnter the code from that page here: ', function (code) {
      rl.close();
      auth.getToken(code, function (err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          return reject(err);
        }
        auth.credentials = token;
        storeToken(token);
        resolve(auth);
      });
    });
  });
}

async function storeToken(token) {
  try {
    _fs2.default.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  await writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

var initialized = void 0;

exports.default = async function initialize() {
  if (!initialized) {
    await authorize();
    initialized = true;
  }

  return drive;
};