// @flow
export const pluralize = (word: string, items: number) =>
  items === 1 ? word : `${word}s`
