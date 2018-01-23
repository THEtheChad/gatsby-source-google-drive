import api from './api'
import fs from 'fs'

const extensions = /jpeg|jpg|png|webp|tif|tiff/
function isImage(node) { return extensions.test(node.mimeType) }

export async function loadNodeContent(node) {
  const drive = await Drive()

  if (isImage(node)) {
    return fs.readFileSync(node.absolutePath)
  }

  return node.content
}