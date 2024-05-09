// @flow
export const validateMintTokensInputs = (
  neoToMint: number,
  gasToMint: number,
  scriptHash: string,
  NEO: number,
  GAS: number,
) => {
  let message

  if (neoToMint < 0 || gasToMint < 0 || (neoToMint === 0 && gasToMint === 0)) {
    message = 'You must send positive amounts of NEO or GAS.'
    return [false, message]
  }

  // eslint-disable-next-line radix
  if (neoToMint && parseFloat(neoToMint) !== parseInt(neoToMint)) {
    message = 'You cannot send fractional NEO to a token sale.'
    return [false, message]
  }

  if (
    (neoToMint && Number.isNaN(neoToMint)) ||
    (gasToMint && Number.isNaN(gasToMint))
  ) {
    message = 'Please enter valid numbers only'
    return [false, message]
  }

  if (neoToMint > NEO) {
    message = 'You do not have enough NEO to send.'
    return [false, message]
  }

  if (gasToMint > GAS) {
    message = 'You do not have enough GAS to send.'
    return [false, message]
  }

  if (
    scriptHash.slice(0, 1) !== '0x' &&
    scriptHash.length !== 42 &&
    scriptHash.length !== 40
  ) {
    message = 'Not a valid script hash.'
    return [false, message]
  }

  return [true, '']
}
