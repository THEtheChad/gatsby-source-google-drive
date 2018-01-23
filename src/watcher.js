import EventEmitter from 'events'
import api from './changes'

const emitter = new EventEmitter()

let pageToken

async function getInitialToken() {
  const res = await api('getStartPageToken')
  pageToken = res.startPageToken
}

async function getChanges() {
  if (!pageToken) await getInitialToken()

  let changes = []
  let page
  do {
    page = await api('list', { pageToken })
    pageToken = page.nextPageToken || page.newStartPageToken
    changes = changes.concat(page.changes)
  }
  while (page.nextPageToken)

  return changes
}

setInterval(async () => {
  const changes = await getChanges()
  changes.forEach(change => emitter.emit(change.type, change))
  changes.forEach(change => emitter.emit('change', change))
}, 5000)

module.exports = emitter