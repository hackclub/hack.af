import { NowRequest, NowResponse } from '@vercel/node'
import isBot from 'isbot'
import querystring from 'querystring'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export default async function (req: NowRequest, res: NowResponse) {
    let { slug, ...query } = req.query

    // remove trailing slash
    slug = (slug as string).replace(/\/$/, '')

    const result = await prisma.link.findUnique({
        where: {
            slug: slug
        }
    })

    if (!result) {
        // backwards compatibility: serve unknown slugs with https://goo.gl
        return res.redirect(302, 'https://goo.gl/' + slug)
    }

    // log access using `result.slug` for record ID
    await logAccess(
        getClientIp(req),
        req.headers['user-agent'],
        result.slug,
        req.url
    )

    const resultQuery = combineQueries(
        querystring.parse(new URL(result.url).searchParams.toString()),
        query
    )

    res.redirect(302, result.url + resultQuery)

    // Increment clicks
    await prisma.link.update({
        where: {
            slug: slug
        },
        data: {
            clicks: {
                increment: 1
            }
        }
    })
}

const combineQueries = (q1: querystring.ParsedUrlQuery, q2: { [key: string]: string | string[] }) => {
    const combinedQuery = { ...q1, ...q2 }
    let combinedQueryString = querystring.stringify(combinedQuery)
    if (combinedQueryString) {
        combinedQueryString = '?' + combinedQueryString
    }
    return combinedQueryString
}

const logAccess = async (ip: string, ua: string, slugRecord: string, url?: string) => {
    // do not log if the BOT_LOGGING flag is off
    if (process.env.BOT_LOGGING == 'off' && isBot(ua)) return

    await prisma.log.create({
        data: {
            timestamp: new Date(),
            clientIP: ip,
            userAgent: ua,
            bot: isBot(ua),
            slug: slugRecord,
            url: url
        }
    })
}

const getClientIp = (req: NowRequest) => {
    let ipAddress: string
    const forwardedIpsStr = req.headers['x-forwarded-for']
    if (forwardedIpsStr) {
        const forwardedIps = (forwardedIpsStr as string).split(',')
        ipAddress = forwardedIps[0]
    }
    if (!ipAddress) {
        ipAddress = req.socket.remoteAddress
    }
    return ipAddress
}