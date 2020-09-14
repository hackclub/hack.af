const fetch = require('isomorphic-unfetch')
const isBot = require('isbot')
const querystring = require('querystring')

module.exports = async (req, res) => {
  let { slug, ...query } = req.query

  // remove trailing slash
  slug = slug.replace(/\/$/, '')
  console.log('SLUG', slug)

  logAccess(getClientIp(req), req.headers['user-agent'], slug, req.url)

  const opts = JSON.stringify({
    filterByFormula: `{slug} = "${slug}"`,
    maxRecords: 1
  })
  console.log(
    `https://airbridge.hackclub.com/v0.1/hack.af/Links?authKey=${process.env.AIRTABLE_KEY}&select=${opts}`
  )
  let resultURL = await fetch(
    `https://airbridge.hackclub.com/v0.1/hack.af/Links?authKey=${process.env.AIRTABLE_KEY}&select=${opts}`
  )
    .then(r => r.json())
    .then(a => (Array.isArray(a) ? a[0] : a))
  console.log('RESULT', resultURL)
  if (!resultURL) {
    return res.status(404).json({ error: '404 not found' })
  }

  const resultQuery = combineQueries(
    querystring.parse(new URL(resultURL).searchParams.toString()),
    query
  )

  res.redirect(302, resultURL + resultQuery)

  if (error == 404) {
    res.redirect(302, 'https://goo.gl/' + slug)
  } else {
    res.status(error)
  }
}

const combineQueries = (q1, q2) => {
  const combinedQuery = { ...q1, ...q2 }
  let combinedQueryString = querystring.stringify(combinedQuery)
  if (combinedQueryString) {
    combinedQueryString = '?' + combinedQueryString
  }
  return combinedQueryString
}

const logAccess = (ip, ua, slug, url) => {
  // do not log if the BOT_LOGGING flag is off
  if (process.env.BOT_LOGGING == 'off' && isBot(ua)) return

  var data = {
    Timestamp: Date.now(),
    'Client IP': ip,
    'User Agent': ua,
    Bot: isBot(ua),
    Slug: [],
    URL: url
  }

  /*
  lookup(slug, true)
    .then(result => {
      data['Slug'][0] = result
    })
    .finally(() => {
      base('Log').create(data, function (err, record) {
        if (err) {
          console.error(err)
          return
        }
      })
    })
    */

  console.log('Logging', data)
}

const getClientIp = req => {
  let ipAddress
  const forwardedIpsStr = req.headers['x-forwarded-for']
  if (forwardedIpsStr) {
    const forwardedIps = forwardedIpsStr.split(',')
    ipAddress = forwardedIps[0]
  }
  if (!ipAddress) {
    ipAddress = req.connection.remoteAddress
  }
  return ipAddress
}
