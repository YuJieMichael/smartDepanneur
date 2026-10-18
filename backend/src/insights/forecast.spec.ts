import {
  forecastFromSales,
  movingAverageForecast,
  storeDateKey,
  toDailySeries,
  weekdayOf,
  weekdaySeasonalForecast,
} from './forecast';

// Four weeks ending on a Saturday: 4 units on weekdays, 12 on Fri and Sat.
function weekendHeavySeries(weeks: number) {
  // 2026-09-06 is a Sunday; the series ends on Saturday 2026-10-03.
  const series: number[] = [];
  for (let day = 0; day < weeks * 7; day += 1) {
    const weekday = day % 7; // 0 = Sunday
    series.push(weekday === 5 || weekday === 6 ? 12 : 4);
  }
  return { series, lastDateKey: '2026-10-03' };
}

describe('demand forecast', () => {
  it('buckets sales by store day and leaves out today', () => {
    const now = new Date('2026-10-15T15:00:00Z'); // 11:00 in Montreal
    const { series, lastDateKey } = toDailySeries(
      [
        { quantity: 3, createdAt: new Date('2026-10-14T23:30:00Z') }, // 19:30 on Oct 14
        { quantity: 2, createdAt: new Date('2026-10-15T03:30:00Z') }, // 23:30 on Oct 14
        { quantity: 5, createdAt: new Date('2026-10-15T14:00:00Z') }, // today
      ],
      now,
      3,
    );

    expect(lastDateKey).toBe('2026-10-14');
    expect(series).toEqual([0, 0, 5]);
    expect(storeDateKey(now)).toBe('2026-10-15');
    expect(weekdayOf('2026-10-15')).toBe(4);
  });

  it('forecasts weekend peaks that a flat average spreads out', () => {
    const { series, lastDateKey } = weekendHeavySeries(4);

    const seasonal = weekdaySeasonalForecast(series, lastDateKey, 7);
    const flat = movingAverageForecast(series, 7);

    expect(seasonal.method).toBe('weekday-seasonal');
    // The horizon starts on Sunday, so Friday and Saturday are the last two days.
    expect(seasonal.daily[5]).toBeGreaterThan(seasonal.daily[1] * 2);
    expect(seasonal.total).toBeCloseTo(flat.total, 0);
    expect(flat.daily.every((value) => value === flat.daily[0])).toBe(true);
  });

  it('falls back to the seven-day average with under two weeks of history', () => {
    const series = [...new Array<number>(50).fill(0), 2, 2, 2, 2, 2, 2];

    const forecast = weekdaySeasonalForecast(series, '2026-10-14', 14);

    expect(forecast.method).toBe('moving-average');
    expect(forecast.total).toBeCloseTo((12 / 7) * 14, 5);
  });

  it('still forecasts a new product whose only sales were today', () => {
    const now = new Date('2026-10-15T18:00:00Z');

    const forecast = forecastFromSales(
      [{ quantity: 4, createdAt: new Date('2026-10-15T14:00:00Z') }],
      now,
      14,
    );

    expect(forecast.method).toBe('moving-average');
    expect(forecast.total).toBeCloseTo((4 / 7) * 14, 5);
  });

  it('forecasts zero demand for a product that has never sold', () => {
    const forecast = weekdaySeasonalForecast(
      new Array<number>(56).fill(0),
      '2026-10-14',
      14,
    );

    expect(forecast.total).toBe(0);
    expect(forecast.peakDaily).toBe(0);
  });
});
