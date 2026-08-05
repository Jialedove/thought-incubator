export const defaultContextBudget = 8_000;
export function clipToContextBudget(value: string, maxChars = defaultContextBudget) {
  return value.slice(0, Math.max(0, maxChars));
}
