import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  DemandForecast,
  movingAverageForecast,
  weekdaySeasonalForecast,
} from '../src/insights/forecast';

// Backtests the weekday-seasonal forecast against the previous seven-day
// average on simulated depanneur demand. The data is synthetic: weekday
// profiles are illustrative, not measured from a real store.
//
//   npm run eval:forecast

type Method = 'moving-average' | 'weekday-seasonal';

interface Profile {
  name: string;
  baseDaily: number;
  // Sunday ... Saturday multipliers.
  weekday: number[];
}

const PROFILES: Profile[] = [
  { name: 'Beer 6-pack', baseDaily: 10, weekday: [1.2, 0.6, 0.6, 0.7, 1.0, 1.8, 2.0] },
  { name: 'Bagged ice', baseDaily: 4, weekday: [1.5, 0.5, 0.5, 0.6, 0.9, 1.8, 2.0] },
  { name: 'Ketchup chips', baseDaily: 7, weekday: [1.2, 0.8, 0.8, 0.8, 1.0, 1.4, 1.5] },
  { name: 'Lottery tickets', baseDaily: 15, weekday: [0.9, 0.8, 1.2, 1.1, 0.8, 1.4, 1.1] },
  { name: 'Energy drink', baseDaily: 6, weekday: [1.1, 0.9, 0.9, 0.9, 1.0, 1.2, 1.1] },
  { name: 'White bread', baseDaily: 5, weekday: [1.3, 0.9, 0.9, 0.9, 1.0, 1.1, 1.2] },
  { name: 'Milk 2% 1L', baseDaily: 8, weekday: [1, 1, 1, 1, 1, 1, 1] },
  { name: 'Cigarettes', baseDaily: 12, weekday: [1, 1, 1, 1, 1, 1, 1] },
  { name: 'Motor oil', baseDaily: 0.3, weekday: [1, 1, 1, 1, 1, 1, 1] },
];

const DAYS = 140;
const WARMUP_DAYS = 56;
const HORIZON = 7;
const LEAD_TIME_DAYS = 2;
const ORDER_COVER_DAYS = 14;
const SEEDS = 30;
// 2026-06-07 is a Sunday, so simulated day 0 is a Sunday.
const START_DATE = Date.UTC(2026, 5, 7, 12);

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, random: () => number) {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal));
  }
  const limit = Math.exp(-lambda);
  let product = random();
  let count = 0;
  while (product > limit) {
    product *= random();
    count += 1;
  }
  return count;
}

function simulateDemand(profile: Profile, random: () => number) {
  const scale = 7 / profile.weekday.reduce((sum, value) => sum + value, 0);
  const trendPerDay = (random() - 0.5) * 0.006; // about ±40% over 140 days at most
  return Array.from({ length: DAYS }, (_, day) => {
    const lambda =
      profile.baseDaily *
      profile.weekday[day % 7] *
      scale *
      Math.max(0.2, 1 + trendPerDay * day);
    return poisson(lambda, random);
  });
}

function dateKey(day: number) {
  return new Date(START_DATE + day * 86_400_000).toISOString().slice(0, 10);
}

function forecast(method: Method, history: number[], lastDay: number, horizon: number): DemandForecast {
  return method === 'moving-average'
    ? movingAverageForecast(history, horizon)
    : weekdaySeasonalForecast(history, dateKey(lastDay), horizon);
}

interface Accumulator {
  absError: number;
  actual: number;
  demand: number;
  lost: number;
  onHandDays: number;
  simDays: number;
  orders: number;
}

function emptyAccumulator(): Accumulator {
  return { absError: 0, actual: 0, demand: 0, lost: 0, onHandDays: 0, simDays: 0, orders: 0 };
}

function evaluate(method: Method, demand: number[], acc: Accumulator) {
  // Forecast accuracy: from every origin, forecast the next seven days.
  for (let origin = WARMUP_DAYS; origin + HORIZON <= DAYS; origin += 1) {
    const result = forecast(method, demand.slice(0, origin), origin - 1, HORIZON);
    for (let offset = 0; offset < HORIZON; offset += 1) {
      acc.absError += Math.abs(result.daily[offset] - demand[origin + offset]);
      acc.actual += demand[origin + offset];
    }
  }

  // Inventory: the app's policy. Reorder when stock falls to the reorder
  // point (forecast demand over the supplier lead time plus half a peak day),
  // ordering enough to cover the next 14 days.
  let onHand = Math.ceil(demand.slice(0, 14).reduce((sum, value) => sum + value, 0) / 2);
  const arrivals = new Map<number, number>();
  for (let day = WARMUP_DAYS; day < DAYS; day += 1) {
    onHand += arrivals.get(day) ?? 0;
    const pending = [...arrivals.entries()].some(([arrival]) => arrival > day);
    const result = forecast(method, demand.slice(0, day), day - 1, ORDER_COVER_DAYS);
    const leadTimeDemand = result.daily
      .slice(0, LEAD_TIME_DAYS)
      .reduce((sum, value) => sum + value, 0);
    const reorderPoint = Math.ceil(leadTimeDemand + 0.5 * result.peakDaily);
    if (!pending && onHand <= reorderPoint) {
      const quantity = Math.max(1, Math.ceil(result.total + reorderPoint - onHand));
      arrivals.set(day + LEAD_TIME_DAYS, quantity);
      acc.orders += 1;
    }

    const sold = Math.min(onHand, demand[day]);
    acc.demand += demand[day];
    acc.lost += demand[day] - sold;
    onHand -= sold;
    acc.onHandDays += onHand;
    acc.simDays += 1;
  }
}

function run() {
  const methods: Method[] = ['moving-average', 'weekday-seasonal'];
  const byProduct = new Map<string, Record<Method, Accumulator>>();
  const total: Record<Method, Accumulator> = {
    'moving-average': emptyAccumulator(),
    'weekday-seasonal': emptyAccumulator(),
  };

  for (let seed = 1; seed <= SEEDS; seed += 1) {
    PROFILES.forEach((profile, index) => {
      const demand = simulateDemand(profile, mulberry32(seed * 1000 + index));
      const product =
        byProduct.get(profile.name) ??
        ({
          'moving-average': emptyAccumulator(),
          'weekday-seasonal': emptyAccumulator(),
        } as Record<Method, Accumulator>);
      byProduct.set(profile.name, product);
      for (const method of methods) {
        const acc = emptyAccumulator();
        evaluate(method, demand, acc);
        for (const target of [product[method], total[method]]) {
          for (const key of Object.keys(acc) as (keyof Accumulator)[]) {
            target[key] += acc[key];
          }
        }
      }
    });
  }

  const metrics = (acc: Accumulator) => ({
    wape: acc.absError / acc.actual,
    fillRate: 1 - acc.lost / acc.demand,
    lostUnits: acc.lost / SEEDS,
    avgOnHand: acc.onHandDays / acc.simDays,
    ordersPerProduct: acc.orders / SEEDS,
  });

  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const rows = [...byProduct.entries(), ['ALL PRODUCTS', total] as const].map(
    ([name, result]) => {
      const before = metrics(result['moving-average']);
      const after = metrics(result['weekday-seasonal']);
      return {
        product: name,
        'WAPE 7d avg': percent(before.wape),
        'WAPE weekday': percent(after.wape),
        'fill 7d avg': percent(before.fillRate),
        'fill weekday': percent(after.fillRate),
        'on-hand 7d avg': before.avgOnHand.toFixed(1),
        'on-hand weekday': after.avgOnHand.toFixed(1),
      };
    },
  );

  console.log(
    `Forecast backtest: ${PROFILES.length} simulated products x ${SEEDS} seeds, ` +
      `${DAYS - WARMUP_DAYS} test days, ${LEAD_TIME_DAYS}-day supplier lead time`,
  );
  console.table(rows);

  const overall = {
    before: metrics(total['moving-average']),
    after: metrics(total['weekday-seasonal']),
  };
  console.log(
    `\nLost sales: ${overall.before.lostUnits.toFixed(0)} -> ${overall.after.lostUnits.toFixed(0)} units per run ` +
      `(${percent(1 - overall.after.lostUnits / overall.before.lostUnits)} fewer); ` +
      `WAPE ${percent(overall.before.wape)} -> ${percent(overall.after.wape)}.`,
  );

  const outDir = path.join(__dirname, 'results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'forecast-backtest.json'),
    `${JSON.stringify({ ranAt: new Date().toISOString(), seeds: SEEDS, overall, rows }, null, 2)}\n`,
  );
}

run();
