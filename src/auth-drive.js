import fs from 'fs'
import path from 'path'
import readline from 'readline'
import google from 'googleapis'
import nconf from 'nconf'
import os from 'os'
import crypto from 'crypto'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const drive = google.drive('v3')

nconf
  .env()
  .required([
    'google_client_id',
    'google_client_secret',
    'google_redirect_uri',
  ]);

const client = {
  secret: nconf.get('google_client_secret'),
  id: nconf.get('google_client_id'),
  scope: ['https://www.googleapis.com/auth/drive.readonly']
};

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
const CLIENT_HASH = crypto.createHash(`md5`).update(JSON.stringify(client)).digest(`hex`);
const TOKEN_DIR = path.resolve(os.homedir(), '.credentials');
const TOKEN_PATH = path.resolve(TOKEN_DIR, `google-${CLIENT_HASH}.json`);

async function authorize() {
  const oauth_client = new google.auth.OAuth2(
    client.id,
    client.secret,
    nconf.get('google_redirect_uri')
  )

  try {
    const token = await readFile(TOKEN_PATH)
    oauth_client.credentials = JSON.parse(token)
  }
  catch (e) {
    await getNewToken(oauth_client)
  }

  // set auth as a global default
  google.options({
    auth: oauth_client
  });

  // we need to do a dirty request to refresh
  // our auth token (bug with drive API)
  await new Promise((resolve, reject) => {
    drive.files.list({},
      (err, res) => resolve())
  })
}

async function getNewToken(auth) {
  console.log('Welcome to Gatsby-Source-Google-Drive Plugin!')
  console.log('---------------------------------------------')
  console.log('(initial setup is required)')
  const auth_url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: client.scope,
  })
  console.log('\nAuthorize this app by visiting:\n', auth_url);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  await new Promise((resolve, reject) => {
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
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  await writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

let initialized;
export default async function initialize() {
  if (!initialized) {
    await authorize()
    initialized = true
  }

  return drive
}