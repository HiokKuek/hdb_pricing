/** OneMap recognises the numeric HDB block identifier, but not the `BLK` prefix. */
export function oneMapBlockSearch(block: string, streetName: string): string {
  return `${block} ${streetName} SINGAPORE`;
}
