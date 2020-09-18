const fetch = require('isomorphic-unfetch')
const isBot = require('isbot')
const querystring = require('querystring')

module.exports = async (req, res) => {
  let { slug, ...query } = req.query

  // remove trailing slash
  slug = slug.replace(/\/$/, '')

  logAccess(getClientIp(req), req.headers['user-agent'], slug, req.url)

  const opts = JSON.stringify({
    filterByFormula: `{slug} = "${slug}"`,
    maxRecords: 1,
  })

  const resultURL = await fetch(
    `https://airbridge.hackclub.com/v0.1/${process.env.AIRTABLE_BASE}/Links?authKey=${process.env.AIRTABLE_KEY}&select=${opts}`
  )
    .then((r) => r.json())
    .then((a) => (Array.isArray(a) ? a[0] : a))
    .then((e) => (e ? e.fields.destination : undefined))

  if (!resultURL) {
    // backwards compatibility: serve unknown slugs with https://goo.gl
    return res.redirect(302, 'https://goo.gl/' + slug)
  }

  const resultQuery = combineQueries(
    querystring.parse(new URL(resultURL).searchParams.toString()),
    query
  )

  return res.redirect(302, resultURL + resultQuery)
}

const combineQueries = (q1, q2) => {
  const combinedQuery = { ...q1, ...q2 }
  let combinedQueryString = querystring.stringify(combinedQuery)
  if (combinedQueryString) {
    combinedQueryString = '?' + combinedQueryString
  }
  return combinedQueryString
}

const logAccess = async (ip, ua, slug, url) => {
  // do not log if the BOT_LOGGING flag is off
  if (process.env.BOT_LOGGING == 'off' && isBot(ua)) return

  const data = {
    Timestamp: Date.now(),
    'Client IP': ip,
    'User Agent': ua,
    Bot: isBot(ua),
    Slug: [],
    URL: url,
  }

  const upload = await fetch(
    `https://airbridge.hackclub.com/v0.1/${process.env.AIRTABLE_BASE}/Log?authKey=${process.env.AIRTABLE_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  )
}

const getClientIp = (req) => {
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
