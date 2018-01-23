import api from './api'
import fs from 'fs-extra'

!async function exec() {
  // const files = await api('list')
  // console.log(files)

  // const file = await api('get', {
  //   fileId: '1ExqOScazpcCzyczXNizpCfY1UDng5RFg',
  //   alt: 'media',
  // }, { encoding: null })

  // await fs.writeFile('test.jpg', file, 'base64')

  // await fs.writeFile(node.absolutePath, source)

  // const file = await api('get', {
  //   fileId: '1gUutZEg_kADPvuKelfAVBQdfqnxNGWF9hymUGJuqXZY',
  //   fields: [
  //     'id',
  //     'mimeType',
  //     'trashed',
  //     'parents',
  //     'name',
  //     'explicitlyTrashed',
  //     'modifiedTime'
  //   ].join()
  // })
  // console.log(file)

  const text = await api('export', {
    fileId: '1gUutZEg_kADPvuKelfAVBQdfqnxNGWF9hymUGJuqXZY',
    mimeType: 'text/html'
  })
  console.log(text)
}().catch(err => { throw err })
