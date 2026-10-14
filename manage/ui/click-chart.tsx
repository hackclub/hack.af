import { css, type Handle } from "remix/component";
import type { ClickSeries } from "../../src/links.ts";
import { formatCompact, formatNumber } from "./public/format.ts";

const chartStyle = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
  "& .plot": { position: "relative", height: "148px" },
  "& svg": { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" },
  "& .bar": { fill: "url(#click-bar)" },
  "& .axis": {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "148px",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    lineHeight: 1,
    transform: "translateY(-0.5em)",
  },
  "& .dates": {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "8px",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  "& g.day:hover rect.bar": { filter: "brightness(1.15)" },
  "& g.day:hover rect.hit": { fill: "var(--surface-hover)" },
});

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

function shortDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ClickChart(handle: Handle<{ series: ClickSeries }>) {
  return () => {
    const { days } = handle.props.series;
    const max = niceMax(Math.max(...days.map((day) => day.clicks)));
    const width = days.length * 10;
    const height = 100;
    const gap = days.length > 60 ? 1.5 : 2.5;
    const mid = days[Math.floor(days.length / 2)];

    return (
      <div mix={chartStyle}>
        <div>
          <div class="plot">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Clicks per day, ${days.length} days`}
            >
              <defs>
                <linearGradient id="click-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#ff8c37" />
                  <stop offset="1" stop-color="#ec3750" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((fraction) => (
                <line
                  key={fraction}
                  x1="0"
                  x2={width}
                  y1={height * fraction}
                  y2={height * fraction}
                  stroke="var(--border-subtle)"
                  stroke-width="1"
                  vector-effect="non-scaling-stroke"
                  stroke-dasharray="3 3"
                />
              ))}
              <line
                x1="0"
                x2={width}
                y1={height}
                y2={height}
                stroke="var(--border)"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
              />
              {days.map((day, index) => {
                const barHeight = day.clicks === 0 ? 0 : Math.max(1.5, (day.clicks / max) * height);
                return (
                  <g key={day.day} class="day">
                    <title>
                      {`${shortDate(day.day)}: ${formatNumber(day.clicks)} ${day.clicks === 1 ? "click" : "clicks"}`}
                    </title>
                    <rect
                      class="hit"
                      x={index * 10}
                      y="0"
                      width="10"
                      height={height}
                      fill="transparent"
                    />
                    <rect
                      class="bar"
                      x={index * 10 + gap / 2}
                      y={height - barHeight}
                      width={10 - gap}
                      height={barHeight}
                      rx="1"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
          <div class="dates" aria-hidden="true">
            <span>{shortDate(days[0]!.day)}</span>
            {mid ? <span>{shortDate(mid.day)}</span> : null}
            <span>Today</span>
          </div>
        </div>
        <div class="axis" aria-hidden="true">
          <span>{formatCompact(max)}</span>
          <span>{formatCompact(max / 2)}</span>
          <span>0</span>
        </div>
      </div>
    );
  };
}
