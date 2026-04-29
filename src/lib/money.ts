import Decimal from 'decimal.js';

export function toMoneyNumber(value: Decimal.Value): number {
  return new Decimal(value || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function addMoney(...values: Decimal.Value[]): number {
  return toMoneyNumber(values.reduce((sum, value) => new Decimal(sum).plus(value || 0), new Decimal(0)));
}

export function subtractMoney(value: Decimal.Value, ...subtractors: Decimal.Value[]): number {
  return toMoneyNumber(
    subtractors.reduce<Decimal>(
      (result, subtrahend) => result.minus(subtrahend || 0),
      new Decimal(value || 0)
    )
  );
}

export function multiplyMoney(left: Decimal.Value, right: Decimal.Value): number {
  return toMoneyNumber(new Decimal(left || 0).times(right || 0));
}
