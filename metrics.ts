import { StatsD } from "hot-shots"
import dotenv from 'dotenv';
dotenv.config();

const graphite = Bun.env.GRAPHITE_HOST

if (graphite == null) {
  throw new Error('Graphite host not configured!')
}

const options = {
  host: graphite,
  port: 8125,
  prefix: `${Bun.env.NODE_ENV}.hackaf.`,
}

const metrics = new StatsD(options)

export default metrics;