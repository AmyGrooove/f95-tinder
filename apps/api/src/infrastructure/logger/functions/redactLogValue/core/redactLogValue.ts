import { isArray } from "@shared/functions/isArray";
import { isObject } from "@shared/functions/isObject";

const redactLogValue = (value: unknown): unknown => {
  if (isArray(value)) {
    return value.map((currentValue) => {
      return redactLogValue(currentValue);
    });
  }

  if (!isObject(value)) {
    return value;
  }

  const redactedEntries = Object.entries(value).map(([key, currentValue]) => {
    if (/password|secret|authorization|cookie|token/i.test(key)) {
      return [key, "[REDACTED]"];
    }

    return [key, redactLogValue(currentValue)];
  });

  return Object.fromEntries(redactedEntries);
};

export { redactLogValue };
