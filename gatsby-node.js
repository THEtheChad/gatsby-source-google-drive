'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sourceNodes = sourceNodes;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _api = require('./api');

var _api2 = _interopRequireDefault(_api);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var folder_cache = {};

async function getFiles(original_params) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var params = Object.assign({}, original_params);
  var files = [];
  var page = void 0;

  do {
    page = await (0, _api2.default)('list', params);
    params.pageToken = page.nextPageToken;
    files = files.concat(page.files);
  } while (opts.all && params.pageToken);

  return files;
}

async function cacheFile(node) {
  var relativePath = node.id + '-' + node.name;
  Object.assign(node, {
    relativePath: relativePath,
    absolutePath: _path2.default.resolve(_os2.default.tmpdir(), relativePath)
  });

  var file = await (0, _api2.default)('get', {
    fileId: node.id,
    alt: 'media'
  }, { encoding: null });

  await _fsExtra2.default.writeFile(node.absolutePath, file);

  return file;
}

var extensions = /jpeg|jpg|png|webp|tif|tiff/;
var isImage = function isImage(node) {
  return extensions.test(node.mimeType);
};
var isDocument = function isDocument(node) {
  return node.mimeType === 'application/vnd.google-apps.document';
};
var isFolder = function isFolder(node) {
  return node.mimeType === 'application/vnd.google-apps.folder';
};

async function toNode(file) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var node = Object.assign(file, {
    parent: null,
    children: [],
    internal: {
      type: 'GoogleDrive',
      mediaType: file.mimeType
    }
  });

  var content = null;
  if (isImage(node) && !opts.removal) {
    // necessary for gatsby-transformer-sharp
    node.extension = _path2.default.extname(file.name).replace(/^\./, '').toLowerCase();
    content = await cacheFile(node);
  } else if (isDocument(node) && !opts.removal) {
    var html = await (0, _api2.default)('export', {
      fileId: node.id,
      mimeType: 'text/html'
    });

    content = node.internal.content = _cheerio2.default.load(html)('body').html();
  } else if (isFolder(node) && !opts.removal) {
    var hydrated = await (0, _api2.default)('get', {
      fileId: node.id,
      fields: ['id', 'mimeType', 'trashed', 'parents', 'kind', 'name', 'explicitlyTrashed', 'modifiedTime', 'description'].join()
    });

    Object.assign(node, hydrated);
    content = JSON.stringify(node);
  } else {
    content = JSON.stringify(node);
  }

  node.internal.contentDigest = _crypto2.default.createHash('md5').update(content).digest('hex');

  return node;
}

async function getFilesFromFolder(folder) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  folder_cache[folder.id] = folder;

  var files = await getFiles({ q: '"' + folder.id + '" in parents and trashed = false' }, {
    all: true
  });
  files.forEach(function (file) {
    return file.path = _path2.default.join(folder.path, encodeURIComponent(folder.name));
  });

  var folders = [files];
  if (opts.recursive) {
    for (var i = 0, l = files.length; i < l; i++) {
      var file = files[i];
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        var subfiles = await getFilesFromFolder(file, opts);
        folders.push(subfiles);
      }
    }
  }

  return folders.reduce(function (allfiles, files) {
    return allfiles.concat(files);
  });
}

async function getFolderFromPath(source) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parts = source.split('/');
  var base = Array.from(parts).splice(0, parts.length - 1);
  var params = {};

  if (parts[0] === '') parts[0] = 'root';

  var target = void 0;
  var parent = parts.pop();
  var match = void 0;

  do {
    target = parent;
    parent = parts.pop();

    if (target === undefined) throw new Error('Folder/file not found!');

    params.q = 'name = "' + target + '" and trashed = false';

    if (parent) {
      params.q += ' and "' + parent + '" in parents';
    }

    match = await (0, _api2.default)('list', params);
  } while (match.files.length !== 1);
  var folder = match.files[0];
  folder.path = base.length === 1 ? '/' : base.join('/');

  return folder;
}

// export const setFieldsOnGraphQLNodeType = require('extend-node.js')

async function sourceNodes(_ref) {
  var boundActionCreators = _ref.boundActionCreators;
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var root = await getFolderFromPath(opts.path);
  folder_cache['root'] = root;

  var files = await getFilesFromFolder(root, { recursive: true });
  var nodes = await _bluebird2.default.map(files, toNode, { concurrency: 10 });

  var createNode = boundActionCreators.createNode,
      deleteNode = boundActionCreators.deleteNode;

  nodes.forEach(function (node) {
    return createNode(node);
  });

  // async function remove(file) {
  //   const node = await toNode(file, { removal: true })
  //   deleteNode(node.id, node)
  // }

  // // listen for changes
  // let count = 0
  // watcher.on('change', async change => {
  //   console.log(`change: ${++count}`)
  //   console.log(change)

  //   if (change.removed === true) {
  //     remove(change.file)
  //     return
  //   }

  //   const hydrated = await api('get', {
  //     fileId: change.fileId,
  //     fields: [
  //       'id',
  //       'mimeType',
  //       'trashed',
  //       'parents',
  //       'name',
  //       'explicitlyTrashed',
  //       'modifiedTime'
  //     ].join()
  //   })

  //   if (hydrated.trashed) {
  //     remove(change.file)
  //     return
  //   }

  //   let folder
  //   hydrated.parents.find(parentId =>
  //     folder = (folder_cache.root.id === hydrated.id) ? root : folder_cache[parentId])

  //   if (!folder) {
  //     remove(change.file)
  //   } else {
  //     change.file.path = path.join(folder.path, folder.name)
  //     const node = await toNode(change.file)
  //     createNode(node)
  //   }
  // })
}