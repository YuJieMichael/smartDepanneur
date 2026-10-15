// Demand forecasting for reorder quantities, minimum-stock review and expiry
// risk. Pure functions so the same code runs in the API, tests and backtests.

export const FORECAST_HISTORY_DAYS = 56;
export const BASELINE_WINDOW_DAYS = 7;
const LEVEL_WINDOW_DAYS = 28;
const MIN_SEASONAL_HISTORY_DAYS = 14;
// Pulls each weekday index toward 1 until that weekday has several samples.
const WEEKDAY_SHRINKAGE = 2;
const STORE_TIME_ZONE = 'America/Toronto';

export type ForecastMethod = 'weekday-seasonal' | 'moving-average';

export interface DemandForecast {
  method: ForecastMethod;
  // Expected units for each day of the horizon, starting today.
  daily: number[];
  total: number;
  averageDaily: number;
  peakDaily: number;
  historyDays: number;
}

export interface SaleQuantity {
  quantity: number;
  createdAt: Date;
}

/** Calendar date (YYYY-MM-DD) in the store's time zone. */
export function storeDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD key. */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/**
 * Units sold per completed store day, oldest first, ending yesterday. Today is
 * excluded because it is still in progress.
 */
export function toDailySeries(
  sales: SaleQuantity[],
  now: Date,
  days = FORECAST_HISTORY_DAYS,
): { series: number[]; lastDateKey: string } {
  const lastDateKey = addDays(storeDateKey(now), -1);
  const firstDateKey = addDays(lastDateKey, -(days - 1));
  const index = new Map<string, number>();
  for (let offset = 0; offset < days; offset += 1) {
    index.set(addDays(firstDateKey, offset), offset);
  }

  const series = new Array<number>(days).fill(0);
  for (const sale of sales) {
    const position = index.get(storeDateKey(sale.createdAt));
    if (position !== undefined) series[position] += sale.quantity;
  }
  return { series, lastDateKey };
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize(
  method: ForecastMethod,
  daily: number[],
  historyDays: number,
): DemandForecast {
  const total = daily.reduce((sum, value) => sum + value, 0);
  return {
    method,
    daily,
    total,
    averageDaily: daily.length === 0 ? 0 : total / daily.length,
    peakDaily: daily.length === 0 ? 0 : Math.max(...daily),
    historyDays,
  };
}

/** The previous rule: the last seven days' average, flat across the horizon. */
export function movingAverageForecast(
  series: number[],
  horizon: number,
): DemandForecast {
  const recent = series.slice(-BASELINE_WINDOW_DAYS);
  const level = recent.reduce((sum, value) => sum + value, 0) / BASELINE_WINDOW_DAYS;
  return summarize(
    'moving-average',
    new Array<number>(horizon).fill(level),
    series.length,
  );
}

/**
 * Recent level times a weekday profile. Depanneur demand swings by weekday
 * (beer and drinks peak Friday to Sunday), which a flat seven-day average
 * spreads evenly and so under-orders before weekends.
 */
export function weekdaySeasonalForecast(
  series: number[],
  lastDateKey: string,
  horizon: number,
): DemandForecast {
  const activeDays = series.length - series.findIndex((value) => value > 0);
  const hasHistory = series.some((value) => value > 0);
  if (!hasHistory || activeDays < MIN_SEASONAL_HISTORY_DAYS) {
    return movingAverageForecast(series, horizon);
  }

  const history = series.slice(-Math.min(series.length, activeDays));
  const overall = mean(history);
  const firstWeekday = weekdayOf(addDays(lastDateKey, -(history.length - 1)));
  const sums = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  history.forEach((value, offset) => {
    const weekday = (firstWeekday + offset) % 7;
    sums[weekday] += value;
    counts[weekday] += 1;
  });

  const rawIndex = sums.map((sum, weekday) =>
    counts[weekday] === 0 || overall === 0 ? 1 : sum / counts[weekday] / overall,
  );
  const shrunk = rawIndex.map(
    (value, weekday) =>
      (counts[weekday] * value + WEEKDAY_SHRINKAGE) /
      (counts[weekday] + WEEKDAY_SHRINKAGE),
  );
  const indexMean = mean(shrunk);
  const weekdayIndex = shrunk.map((value) => value / indexMean);

  // The level is deseasonalized (units over expected weekday weight) so a
  // window that starts on a busy day does not inflate it.
  const levelWindow = history.slice(-LEVEL_WINDOW_DAYS);
  const levelStartWeekday = weekdayOf(
    addDays(lastDateKey, -(levelWindow.length - 1)),
  );
  const expectedWeight = levelWindow.reduce(
    (sum, _value, offset) =>
      sum + weekdayIndex[(levelStartWeekday + offset) % 7],
    0,
  );
  const level =
    levelWindow.reduce((sum, value) => sum + value, 0) / expectedWeight;

  const todayWeekday = weekdayOf(addDays(lastDateKey, 1));
  const daily = Array.from(
    { length: horizon },
    (_, offset) => level * weekdayIndex[(todayWeekday + offset) % 7],
  );
  return summarize('weekday-seasonal', daily, history.length);
}

export function forecastFromSales(
  sales: SaleQuantity[],
  now: Date,
  horizon: number,
): DemandForecast {
  const { series, lastDateKey } = toDailySeries(sales, now);
  const seasonal = weekdaySeasonalForecast(series, lastDateKey, horizon);
  if (seasonal.method === 'weekday-seasonal') return seasonal;

  // New products: the rolling last 7 x 24 hours, today included, so a product
  // that only started selling today still gets a forecast.
  const since = now.getTime() - BASELINE_WINDOW_DAYS * 86_400_000;
  const recent = sales
    .filter((sale) => sale.createdAt.getTime() >= since)
    .reduce((sum, sale) => sum + sale.quantity, 0);
  return summarize(
    'moving-average',
    new Array<number>(horizon).fill(recent / BASELINE_WINDOW_DAYS),
    seasonal.historyDays,
  );
}
