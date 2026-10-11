# The hub dashboard

Vite, Svelte 5 (runes), TypeScript, and ECharts. The hub serves `dist/`.

```bash
npm run check    # svelte-check and tsc: zero errors
npm run build    # writes dist/
VITE_HUB_URL=http://127.0.0.1:8787 npm run dev
```

## Design rules

- Text and numbers carry the page. Use label and value tables (`KV`), dense tables
  (`table.t`), and one sentence in plain words. Do not use a grid of cards, tiles
  with large numbers, score rings, or icons for decoration.
- A panel (`.panel`) is for a chart only.
- One colour for each data family: `--c-activity`, `--c-heart`, `--c-sleep`,
  `--c-nutrition`, `--c-body`, `--c-mobility`, `--c-hearing`, `--c-respiratory`,
  `--c-mindfulness`, `--c-other`. `--c-x` paints marks. `--c-x-ink` is for text.
  `--ring` and `--watch` tell the two sources apart on a shared chart.
- `--good`, `--warn`, and `--alert` show a status only, always with a label.
- Motion uses `--dur-fast`, `--dur`, `--dur-slow`, and `--ease`. All motion stops
  under `prefers-reduced-motion`. If an animation makes a page slower to read,
  remove it.

## Where things are

| Path | Contents |
| --- | --- |
| `src/app.css` | Tokens and the shared classes |
| `src/App.svelte` | The top bar and the routes (`#/<tab>/<param>`) |
| `src/pages/` | One file for each page |
| `src/components/` | Shared pieces: `PageHeader`, `Section`, `KV`, `Seg`, `Num`, `Duration`, `RangePicker`, `ChartFrame`, `MetricChart`, `MetricRow`, `Spark`, `NoData`, `OutOfRange`, `Empty`, `ErrorNote`, `Skeleton` |
| `src/components/<area>/` | The pieces of one page. An area must not import from another area. |
| `src/i18n/<area>.ts` | The words of one area, in English and in Chinese |
| `src/lib/i18n.svelte.ts` | `t(key, vars)`, the locale, `intlTag()` |
| `src/lib/fmt.ts` | Dates, numbers, and durations through `Intl` |
| `src/lib/kinds.ts` | The catalogue of Apple Health kinds: group, colour, decimals, chart type |
| `src/lib/health.svelte.ts` | The cached loader for the Apple Health tools |
| `src/lib/range.ts` | Time ranges and the bucket rule (pure) |
| `src/lib/charts.ts` | The ECharts setup: `base()`, the `chart` action, `bucketAxis`, `bucketLabel`, `fitAxis`, mark lines, tooltips |

Read these pages as the examples:

- `src/pages/Activity.svelte`: `MetricChart`, `MetricRow`, `OutOfRange`, and a page chart in a `ChartFrame`.
- `src/pages/Body.svelte`: charts and tables from one load of all dates.
- `src/components/trends/RingTrend.svelte`: `MetricChart` with a series of its own.

## How to add text

1. Add a key to `en` in `src/i18n/<area>.ts`.
2. Add the same key to `zh`. The type check fails until you do.
3. Call `t('<area>.<key>')`. Put a variable in the text as `{name}` and give it as
   `t(key, { name })`.

Keep units, product names, and code literals as they are. Do not write a date, a
number, or a duration by hand: use `src/lib/fmt.ts`.

## How to show a kind

```svelte
<script lang="ts">
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import MetricRow from '../components/MetricRow.svelte'
  import type { RangeId } from '../lib/range'
  let range = $state<RangeId>('M')
</script>

<RangePicker bind:value={range} />
<MetricChart kind="step_count" {range} />
<MetricRow kind="flights_climbed" {range} />
```

Components that mount together send one request for their light kinds. A kind with
very many rows (`heart_rate`, `active_energy`, `basal_energy`, `physical_effort`,
`step_count`) goes in a request of its own, so it does not hold back the others.

## Charts

- Every chart sits in a `ChartFrame`: title, the label of the number, the number with
  its unit, the dates, a legend, then the plot. `MetricChart` fills the frame for one
  value per day. A page chart gives the frame its own ECharts option.
- Use `bucketAxis` for the x axis and `bucketLabel` for the tooltip of a chart with one
  mark per day, week, or month.
- A dashed line is the average of the period. Its text gives the same number as the
  head. A solid line is a reference from a named source.
- A line stops at a gap longer than `MAX_GAP` (`src/lib/range.ts`).
- When a period has no data, use `NoData` or `noDataText`. The text gives the dates
  that have data.
