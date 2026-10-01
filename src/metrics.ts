import { StatsD } from "hot-shots";

let metrics: StatsD | null = null;

export function initGraphite() {
  const graphite = Bun.env.GRAPHITE_HOST;

  if (graphite == null) {
    console.warn("Graphite host not configured!");
    return;
  }
  
  const options = {
    host: graphite,
    port: 8125,
    prefix: `${Bun.env.NODE_ENV}.hackaf.`,
  };

  metrics = new StatsD(options);
}

export function incrementMetric(metricName: string, int: number = 1) {
  if (metrics == null) {
    return;
  }

  metrics.increment(metricName, int);
}

export function timingMetric(metricName: string, time: number) {
  if (metrics == null) {
    return;
  }

  metrics.timing(metricName, time);
}