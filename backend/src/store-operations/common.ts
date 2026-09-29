import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

export type Operator = { id: number; email: string };
export const STORE_TIME_ZONE = 'America/Toronto';
export const storeDate = (value = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
export function calendarDate(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Use YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid calendar date');
  return date;
}
export function dateRange(value = storeDate()) {
  const day = calendarDate(value);
  const midnight = (date: Date) => {
    const guess = date.getTime();
    let result = guess;
    // Re-evaluate the offset at the candidate instant to handle DST boundaries.
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: STORE_TIME_ZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(new Date(result))
          .filter((p) => p.type !== 'literal')
          .map((p) => [p.type, Number(p.value)]),
      );
      const represented = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
      result = guess - (represented - result);
    }
    return new Date(result);
  };
  return {
    date: value,
    start: midnight(day),
    end: midnight(new Date(day.getTime() + 86400000)),
  };
}
export function amount(value: unknown, signed = false) {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new BadRequestException('Amount is required');
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(value)))
    throw new BadRequestException('Amount must have at most two decimals');
  const result = new Prisma.Decimal(value);
  if (
    !result.isFinite() ||
    (!signed && result.isNegative()) ||
    result.abs().greaterThan('99999999.99')
  )
    throw new BadRequestException('Invalid amount');
  return result;
}
export function integer(value: unknown, allowZero = false) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > 10000000
  )
    throw new BadRequestException('Invalid quantity or ID');
  return value;
}
export function requestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(value))
    throw new BadRequestException('A requestId is required');
  return value;
}
export const hash = (value: unknown) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
export async function lockKey(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function audit(
  tx: Prisma.TransactionClient,
  operator: Operator,
  table: string,
  recordId: number,
  field: string,
  value: unknown,
) {
  await tx.auditTrail.create({
    data: {
      table,
      recordId,
      field,
      oldValue: null,
      newValue: JSON.stringify(value),
      userId: operator.id,
      userEmail: operator.email,
    },
  });
}
