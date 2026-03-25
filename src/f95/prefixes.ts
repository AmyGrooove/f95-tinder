const ENGINE_PREFIX_ID_SET = new Set<number>([
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  12,
  14,
  17,
  30,
  31,
  47,
]);

const getEnginePrefixIdList = (value: number[] | undefined) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (prefixId): prefixId is number =>
          Number.isInteger(prefixId) &&
          Number.isFinite(prefixId) &&
          ENGINE_PREFIX_ID_SET.has(prefixId),
      ),
    ),
  );
};

export { ENGINE_PREFIX_ID_SET, getEnginePrefixIdList };
