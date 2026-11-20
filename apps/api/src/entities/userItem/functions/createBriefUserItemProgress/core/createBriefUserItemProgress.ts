const createBriefUserItemProgress = (attemptPath: string) => ({
  $cond: [
    { $ne: [{ $ifNull: [`${attemptPath}.progress`, null] }, null] },
    {
      value: `${attemptPath}.progress`,
      unit: `${attemptPath}.unit`,
    },
    null,
  ],
})

export { createBriefUserItemProgress }
