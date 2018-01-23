import Drive from './auth-drive'

export default async function Files(method, params = {}, opts = {}, ctx = { attempts: 0 }) {
  // console.log(`  ${method} ${ctx.attempts} => ${JSON.stringify(params)}`)
  const drive = await Drive()

  return new Promise((resolve, reject) => {
    function backoff() {
      if (++ctx.attempts > 7) {
        reject('Usage Limit Exceeded')
        return
      }

      setTimeout(() => {
        const next = Files(method, params, opts, ctx)
        resolve(next)
      }, Math.pow(2, ctx.attempts) * 200)
    }

    const request = drive.files[method](params, opts, (err, body) => {
      if (!err) {
        return resolve(body)
      }

      if (err.code === 403)
        return backoff()

      console.log(`ERROR!!! ============================ ${err.code}`)
      reject(err)
    })
  })
}