import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import crypto from 'crypto'
import cheerio from 'cheerio'
import watcher from './watcher'
import api from './api'

const folder_cache = {}

process.on('unhandledRejection', err => { throw err })

async function getFiles(original_params, opts = {}) {
  const params = Object.assign({}, original_params)
  let files = []
  let page

  do {
    page = await api('list', params)
    params.pageToken = page.nextPageToken
    files = files.concat(page.files)
  }
  while (opts.all && params.pageToken)

  return files;
}

async function cacheFile(node) {
  const relativePath = `${node.id}-${node.name}`;
  Object.assign(node, {
    relativePath,
    absolutePath: path.resolve(os.tmpdir(), relativePath),
  })

  const file = await api('get', {
    fileId: node.id,
    alt: 'media',
  }, { encoding: null })

  await fs.writeFile(node.absolutePath, file)

  return file
}

const extensions = /jpeg|jpg|png|webp|tif|tiff/
function isImage(node) { return extensions.test(node.mimeType) }
function isDocument(node) { return node.mimeType === 'application/vnd.google-apps.document' }

async function toNode(file, opts = {}) {
  const node = Object.assign(file, {
    parent: null,
    children: [],
    internal: {
      type: 'GoogleDrive',
      mediaType: file.mimeType,
    }
  })

  let content = null
  if (isImage(node) && !opts.removal) {
    // necessary for gatsby-transformer-sharp
    node.extension = path.extname(file.name).replace(/^\./, '').toLowerCase()
    content = await cacheFile(node)
  }
  else if (isDocument(node) && !opts.removal) {
    const html = await api('export', {
      fileId: node.id,
      mimeType: 'text/html'
    })

    content = node.internal.content = cheerio
      .load(html)('body')
      .html()
  }
  else {
    content = JSON.stringify(node)
  }

  node.internal.contentDigest = crypto
    .createHash(`md5`)
    .update(content)
    .digest(`hex`)

  return node
}

async function getFilesFromFolder(folder, opts = {}) {
  folder_cache[folder.id] = folder

  let files = await getFiles({ q: `"${folder.id}" in parents and trashed = false` }, {
    all: true
  })
  files.forEach(file => file.path = path.join(folder.path, folder.name))

  let folders = [files]
  if (opts.recursive) {
    for (let i = 0, l = files.length; i < l; i++) {
      const file = files[i]
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subfiles = await getFilesFromFolder(file, opts)
        folders.push(subfiles)
      }
    }
  }

  return folders.reduce((allfiles, files) =>
    allfiles.concat(files))
}

async function getFolderFromPath(source, opts = {}) {
  const parts = source.split('/')
  const base = Array.from(parts).splice(0, parts.length - 1)
  const params = {}

  if (parts[0] === '')
    parts[0] = 'root'

  let target
  let parent = parts.pop()
  let match

  do {
    target = parent
    parent = parts.pop()

    if (target === undefined)
      throw new Error('Folder/file not found!')

    params.q = `name = "${target}" and trashed = false`

    if (parent) {
      params.q += ` and "${parent}" in parents`
    }

    match = await api('list', params)
  }
  while (match.files.length !== 1)
  const folder = match.files[0]
  folder.path = (base.length === 1) ? '/' : base.join('/')

  return folder
}

async function toNodes(arr) {
  const processed = arr.map(toNode)
  return await Promise.all(processed)
}

// export const setFieldsOnGraphQLNodeType = require('extend-node.js')

export async function sourceNodes({ boundActionCreators }, opts = {}) {
  const root = await getFolderFromPath(opts.path)
  folder_cache['root'] = root

  const files = await getFilesFromFolder(root, { recursive: true })
  const nodes = await toNodes(files)

  const { createNode, deleteNode } = boundActionCreators
  nodes.forEach(node => createNode(node));

  async function remove(file) {
    const node = await toNode(file, { removal: true })
    deleteNode(node.id, node)
  }

  // listen for changes
  let count = 0
  watcher.on('change', async change => {
    console.log(`change: ${++count}`)
    console.log(change)

    if (change.removed === true) {
      remove(change.file)
      return
    }

    const hydrated = await api('get', {
      fileId: change.fileId,
      fields: [
        'id',
        'mimeType',
        'trashed',
        'parents',
        'name',
        'explicitlyTrashed',
        'modifiedTime'
      ].join()
    })

    if (hydrated.trashed) {
      remove(change.file)
      return
    }

    let folder
    hydrated.parents.find(parentId =>
      folder = (folder_cache.root.id === hydrated.id) ? root : folder_cache[parentId])

    if (!folder) {
      remove(change.file)
    } else {
      change.file.path = path.join(folder.path, folder.name)
      const node = await toNode(change.file)
      createNode(node)
    }
  })
}