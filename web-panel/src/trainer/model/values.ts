import { ECheatType, type CheatOption, type CheatOptionLike, type CheatSchema } from '../../../protocol/messages';

const NUMBER_GROUP_SEPARATOR_PATTERN = /[,\s]/g;

/** Returned by `normalizeCheatValue` when the input cannot be sent to the trainer. */
export const INVALID_CHEAT_VALUE: unique symbol = Symbol('invalid-cheat-value');

export type NormalizedCheatValue = unknown | typeof INVALID_CHEAT_VALUE;

export function resolveOption(option: CheatOptionLike): CheatOption {
  if (typeof option === 'string' || typeof option === 'number') {
    return { label: String(option), value: option };
  }

  return {
    label: option.label ?? String(option.value),
    value: option.value,
  };
}

/** Option values arrive as strings or numbers depending on the trainer; compare them loosely. */
export function isSameOptionValue(left: unknown, right: unknown): boolean {
  return String(left) === String(right);
}

/**
 * Coerces a raw control value into what the trainer expects.
 * Numeric cheats accept grouped strings ("1,000"), are clamped to `args.min`/`args.max`,
 * and yield `INVALID_CHEAT_VALUE` for partial or non-numeric input ("", "-", "abc")
 * instead of leaking `NaN` (serialized as `null`) to the trainer.
 */
export function normalizeCheatValue(cheat: CheatSchema, value: unknown): NormalizedCheatValue {
  if (cheat.type === ECheatType.Toggle) {
    return Boolean(value);
  }

  if (cheat.type !== ECheatType.Slider && cheat.type !== ECheatType.Number) {
    return value;
  }

  const numeric = toNumber(value);
  if (numeric === null) {
    return INVALID_CHEAT_VALUE;
  }

  return clamp(numeric, cheat.args.min, cheat.args.max);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = stripNumberGrouping(value.trim());
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let result = value;
  if (typeof min === 'number' && result < min) result = min;
  if (typeof max === 'number' && result > max) result = max;
  return result;
}

export function stripNumberGrouping(value: string): string {
  return value.replace(NUMBER_GROUP_SEPARATOR_PATTERN, '');
}
