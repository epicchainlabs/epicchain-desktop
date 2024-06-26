// @flow
import { api, sc, u, wallet, settings } from '@cityofzion/neon-js-legacy'
import {
  api as n3Api,
  wallet as n3Wallet,
  u as n3U,
  rpc as n3Rpc,
  tx,
} from '@cityofzion/neon-js'
import { flatMap, keyBy, isEmpty, get } from 'lodash-es'
import axios from 'axios'

import {
  showErrorNotification,
  showInfoNotification,
  showSuccessNotification,
} from './notifications'
import {
  getNetwork,
  getWIF,
  getPublicKey,
  getSigningFunction,
  getAddress,
  getIsHardwareLogin,
  getAssetBalances,
  getTokenBalances,
} from '../core/deprecated'
import {
  isToken,
  validateTransactionsBeforeSending,
  getTokenBalancesMap,
} from '../core/wallet'
import { toNumber } from '../core/math'
import { getNode, getRPCEndpoint } from '../actions/nodeStorageActions'
import { addPendingTransaction } from '../actions/pendingTransactionActions'
import { getSettings } from '../actions/settingsActions'

const N2 = require('@cityofzion/neon-js-legacy-latest')

const { reverseHex, ab2hexstring } = u

const MAX_FREE_TX_SIZE = 1024
const FEE_PER_EXTRA_BYTE = 0.00001
const LOW_PRIORITY_THRESHOLD_GAS_AMOUNT = 0.001
const RPC_TIMEOUT_OVERRIDE = 60000
const FEE_OPTIONS = {
  LOW: 0.001,
  MEDIUM: 0.05,
  HIGH: 0.1,
}

settings.timeout.rpc = RPC_TIMEOUT_OVERRIDE

const extractTokens = (sendEntries: Array<SendEntryType>) =>
  sendEntries.filter(({ symbol }) => isToken(symbol))

const extractAssets = (sendEntries: Array<SendEntryType>) =>
  sendEntries.filter(({ symbol }) => !isToken(symbol))

export const buildIntents = (sendEntries: Array<SendEntryType>) => {
  const assetEntries = extractAssets(sendEntries)
  // $FlowFixMe
  return flatMap(assetEntries, ({ address, amount, symbol }) =>
    N2.api.makeIntent({ [symbol]: toNumber(amount) }, address),
  )
}

export const buildTransferScript = (
  net: NetworkType,
  sendEntries: Array<SendEntryType>,
  fromAddress: string,
  tokensBalanceMap: {
    [key: string]: TokenBalanceType,
  },
) => {
  const tokenEntries = extractTokens(sendEntries)
  const fromAcct = new wallet.Account(fromAddress)
  const scriptBuilder = new sc.ScriptBuilder()

  tokenEntries.forEach(({ address, amount, symbol }) => {
    const toAcct = new wallet.Account(address)
    const { scriptHash, decimals = 8 } = tokensBalanceMap[symbol]
    const args = [
      u.reverseHex(fromAcct.scriptHash),
      u.reverseHex(toAcct.scriptHash),
      sc.ContractParam.byteArray(toNumber(amount), 'fixed8', decimals),
    ]

    scriptBuilder.emitAppCall(scriptHash, 'transfer', args)
  })
  return scriptBuilder.str
}

const makeRequest = async (
  sendEntries: Array<SendEntryType>,
  config: Object,
  script: string,
  isHardwareSend?: boolean,
) => {
  config.intents = buildIntents(sendEntries)

  // eslint-disable-next-line
  const apiProvider = new N2.api.neoCli.instance(config.url)
  config.api = apiProvider
  config.script = script
  config.gas = !script ? undefined : 0

  config = await N2.api.fillSigningFunction(config)
  config = await N2.api.fillUrl(config)
  config = await N2.api.fillBalance(config)

  if (isHardwareSend) {
    if (script) {
      return api.doInvoke(config).catch(e => {
        if (e.message === 'this.str.substr is not a function') {
          return {
            response: {
              result: true,
            },
          }
        }
      })
    }
    config = await N2.api.createContractTx(config)
    return api.sendAsset(config).catch(e => {
      if (e.message === 'this.str.substr is not a function') {
        return {
          response: {
            result: true,
          },
        }
      }
    })
  }
  return script ? N2.api.doInvoke(config) : N2.api.sendAsset(config)
}

export const generateBalanceInfo = (
  tokensBalanceMap: any,
  address: string,
  net: NetworkType,
) => {
  const Balance = new wallet.Balance({ address, net })
  // $FlowFixMe
  Object.values(tokensBalanceMap).forEach(({ name, balance }) => {
    Balance.addAsset(name, { balance, unspent: [] })
  })
}

// This adds some random bits to the transaction to prevent any hash collision.
export const attachAttributesForEmptyTransaction = (
  config: api.apiConfig,
  addressString?: string,
) => {
  config.tx.addAttribute(
    32,
    reverseHex(
      wallet.getScriptHashFromAddress(addressString || config.address),
    ),
  )
  config.tx.addRemark(
    Date.now().toString() + ab2hexstring(wallet.generateRandomArray(4)),
  )
  return config
}

// Convert a hex string to a byte array (adopted from crypto js)
export const hexStringToByteArray = (hex: string = '0') => {
  // eslint-disable-next-line
  for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16))
  // eslint-disable-next-line
  return bytes
}

export const calculateTransactionFees = (bytes: Array<number>) => {
  let fee = 0
  if (bytes.length > MAX_FREE_TX_SIZE) {
    const requiredFee = FEE_PER_EXTRA_BYTE * (bytes.length - MAX_FREE_TX_SIZE)
    if (requiredFee < LOW_PRIORITY_THRESHOLD_GAS_AMOUNT) {
      fee = LOW_PRIORITY_THRESHOLD_GAS_AMOUNT
    } else {
      fee = requiredFee
    }
  }
  return fee
}

export const checkConfigForFees = (config: {
  fees: number,
  tx: { serialize: () => string } | void,
}): Promise<void> =>
  new Promise((resolve, reject) => {
    if (config.tx) {
      const feeSize = calculateTransactionFees(
        hexStringToByteArray(config.tx.serialize()),
      )
      if (feeSize > config.fees) {
        const gasFeeOption = Object.keys(FEE_OPTIONS)
          .map(key => FEE_OPTIONS[key])
          .find((feeOption: number) => feeOption >= feeSize)

        return reject(
          new Error(
            `Based on the size of this transaction a fee of at least ${gasFeeOption ||
              feeSize} GAS is required.`,
          ),
        )
      }
      return resolve()
    }
    return resolve()
  })

const buildNep17IntentsFromEntries = (
  sendEntries: Array<SendEntryType>,
  tokens,
  tokensBalanceMap,
  config,
) =>
  sendEntries.map(entry => {
    const { address, amount, symbol } = entry

    const token = tokens.find(
      // eslint-disable-next-line eqeqeq
      t => Number(t?.networkId) == 2 && t?.symbol === symbol,
    )
    const contractHash = token
      ? token.scriptHash
      : tokensBalanceMap[symbol] && tokensBalanceMap[symbol].scriptHash

    entry.contractHash = contractHash || ''
    const intent = {
      from: config.account,
      to: address,
      decimalAmt: amount,
      contractHash,
    }
    return intent
  })

export const calculateN3Fees = ({
  sendEntries,
}: {
  sendEntries: Array<SendEntryType>,
}) => (dispatch: DispatchType, getState: GetStateType): Promise<*> =>
  new Promise(async (resolve, reject) => {
    try {
      const state = getState()
      const net = getNetwork(state)
      const wif = getWIF(state)
      const FROM_ACCOUNT = new n3Wallet.Account(wif)
      const tokenBalances = getTokenBalances(state)
      const tokensBalanceMap = keyBy(tokenBalances, 'symbol')
      const settings = await getSettings()
      const tokens = settings?.tokens ?? []

      if (tokens.length) {
        let endpoint = await getNode(net)
        if (!endpoint) {
          endpoint = await getRPCEndpoint(net)
        }
        const client = new n3Rpc.NeoServerRpcClient(endpoint)

        const intents = buildNep17IntentsFromEntries(
          sendEntries,
          tokens,
          tokensBalanceMap,
          { account: FROM_ACCOUNT },
        )

        const txBuilder = new n3Api.TransactionBuilder()
        for (const intent of intents) {
          if (intent.decimalAmt) {
            const [tokenInfo] = await n3Api.getTokenInfos(
              [intent.contractHash],
              client,
            )
            const amt = n3U.BigInteger.fromDecimal(
              intent.decimalAmt,
              tokenInfo.decimals,
            )
            txBuilder.addNep17Transfer(
              intent.from,
              intent.to,
              intent.contractHash,
              amt,
            )
          }
        }
        const {
          feePerByte,
          executionFeeFactor,
        } = await n3Api.getFeeInformation(client)

        const txn = txBuilder.build()

        const networkFee = await n3Api.calculateNetworkFee(
          txn,
          feePerByte,
          executionFeeFactor,
        )

        const invokeFunctionResponse = await client.invokeScript(
          n3U.HexString.fromHex(txn.script),
          [
            {
              account: FROM_ACCOUNT.scriptHash,
              scopes: tx.WitnessScope.CalledByEntry,
            },
          ],
        )
        const requiredSystemFee = n3U.BigInteger.fromNumber(
          invokeFunctionResponse.gasconsumed,
        )

        return resolve({
          systemFee: requiredSystemFee.toDecimal(8),
          networkFee: networkFee.toDecimal(8),
        })
      }
    } catch (e) {
      console.error(e)
      reject(e)
    }
  })

export const sendTransaction = ({
  sendEntries,
  fees = 0,
  isWatchOnly,
  chain,
}: {
  sendEntries: Array<SendEntryType>,
  fees: number,
  isWatchOnly?: boolean,
  chain: string,
}) => (dispatch: DispatchType, getState: GetStateType): Promise<*> => {
  const state = getState()
  const wif = getWIF(state)
  const fromAddress = getAddress(state)
  const net = getNetwork(state)
  const tokenBalances = getTokenBalances(state)
  const tokensBalanceMap = keyBy(tokenBalances, 'symbol')
  const balances = {
    ...getAssetBalances(state),
    ...getTokenBalancesMap(tokenBalances),
  }
  const signingFunction = getSigningFunction(state)
  const publicKey = getPublicKey(state)
  const isHardwareSend = getIsHardwareLogin(state)
  const { tokens } = state.spunky.settings.data
  return chain === 'neo3'
    ? new Promise(async (resolve, reject) => {
        try {
          if (!isWatchOnly)
            dispatch(
              showInfoNotification({
                message: 'Broadcasting transaction to network...',
                autoDismiss: 0,
              }),
            )

          let endpoint = await getNode(net)
          if (!endpoint) {
            endpoint = await getRPCEndpoint(net)
          }

          const rpcClient = new n3Rpc.RPCClient(endpoint)
          const version = await rpcClient.execute(
            new n3Rpc.Query({
              method: 'getversion',
              params: [],
            }),
          )

          const networkMagic =
            version.protocol.network ||
            version.network ||
            version.magic ||
            860833102

          const FROM_ACCOUNT = new n3Wallet.Account(
            isHardwareSend ? publicKey : wif,
          )

          const CONFIG = {
            account: FROM_ACCOUNT,
            rpcAddress: endpoint,
            networkMagic,
          }

          const facade = await n3Api.NetworkFacade.fromConfig({
            node: endpoint,
          })

          if (isHardwareSend && !isWatchOnly) {
            dispatch(
              showInfoNotification({
                message: 'Please sign the transaction on your hardware device',
                autoDismiss: 0,
              }),
            )
          }

          const signingConfig = {
            signingCallback: isHardwareSend
              ? signingFunction
              : n3Api.signWithAccount(CONFIG.account),
          }

          const nep17Intents = buildNep17IntentsFromEntries(
            sendEntries,
            tokens,
            tokensBalanceMap,
            CONFIG,
          )

          const results = await facade.transferToken(
            nep17Intents,
            signingConfig,
          )

          dispatch(
            showSuccessNotification({
              message:
                'Transaction pending! Your balance will automatically update when the blockchain has processed it.',
            }),
          )

          if (!isWatchOnly) {
            dispatch(
              addPendingTransaction.call({
                address: CONFIG.account.address,
                tx: {
                  hash: results,
                  txid: results,
                  sendEntries,
                },
                net,
              }),
            )
          }
          return resolve({ txid: results })
        } catch (e) {
          console.error({ e })
          return reject(e)
        }
      })
    : new Promise(async (resolve, reject) => {
        let url = await getNode(net)
        if (isEmpty(url)) {
          url = await getRPCEndpoint(net)
        }

        const rejectTransaction = (message: string) =>
          dispatch(showErrorNotification({ message }))

        const error = validateTransactionsBeforeSending(balances, sendEntries)

        if (error) {
          console.error({ error })
          rejectTransaction(error)
          return reject(error)
        }

        if (!isWatchOnly)
          dispatch(
            showInfoNotification({
              message: 'Broadcasting transaction to network...',
              autoDismiss: 0,
            }),
          )

        if (isHardwareSend && !isWatchOnly) {
          dispatch(
            showInfoNotification({
              message: 'Please sign the transaction on your hardware device',
              autoDismiss: 0,
            }),
          )
        }

        const ledgerAccount = new N2.wallet.Account(publicKey)

        const config = {
          net,
          tokensBalanceMap,
          address: fromAddress,
          publicKey,
          privateKey: isHardwareSend
            ? null
            : new wallet.Account(wif).privateKey,
          signingFunction: isHardwareSend ? signingFunction : null,
          fees,
          url,
          balance: undefined,
          tx: undefined,
          intents: undefined,
          script: undefined,
          gas: undefined,
          account: isHardwareSend ? ledgerAccount : new wallet.Account(wif),
        }

        if (net === 'MainNet') {
          const mainnetBalances = await axios.get(
            `https://dora.coz.io/api/v1/neo2/mainnet/get_balance/${fromAddress}`,
          )
          const parsedMainnetBalances = {}
          mainnetBalances.data.balance.forEach(token => {
            parsedMainnetBalances[token.asset_symbol || token.symbol] = {
              name: token.asset_symbol || token.symbol,
              balance: token.amount,
              unspent: token.unspent,
            }
          })
          const Balance = new wallet.Balance({ address: fromAddress, net })
          Object.values(parsedMainnetBalances).forEach(
            // $FlowFixMe
            ({ name, balance, unspent }) => {
              if (name === 'GAS' || name === 'NEO') {
                Balance.addAsset(name, { balance, unspent })
              } else {
                Balance.addToken(name, balance)
              }
            },
          )
          config.balance = Balance
        }
        if (net === 'TestNet') {
          const testnetBalances = await axios.get(
            `https://dora.coz.io/api/v1/neo2/testnet/get_balance/${fromAddress}`,
          )
          const parsedTestNetBalances = {}
          testnetBalances.data.balance.forEach(token => {
            parsedTestNetBalances[token.asset_symbol || token.symbol] = {
              name: token.asset_symbol || token.symbol,
              balance: token.amount,
              unspent: token.unspent,
            }
          })
          const Balance = new wallet.Balance({ address: fromAddress, net })
          Object.values(parsedTestNetBalances).forEach(
            // $FlowFixMe
            ({ name, balance, unspent }) => {
              if (name === 'GAS' || name === 'NEO') {
                Balance.addAsset(name, { balance, unspent })
              } else {
                Balance.addToken(name, balance)
              }
            },
          )
          config.balance = Balance
        }

        try {
          const script = buildTransferScript(
            config.net,
            sendEntries,
            config.address,
            // $FlowFixMe
            config.tokensBalanceMap,
          )

          if (isWatchOnly) {
            config.intents = buildIntents(sendEntries)
            config.script = script
            if (script) {
              config.gas = 0
              api.createTx(config, 'invocation')
              attachAttributesForEmptyTransaction(config)
            } else {
              api.createTx(config, 'contract')
              attachAttributesForEmptyTransaction(config)
            }

            await checkConfigForFees(config)

            return resolve(config)
          }

          const { response } = await makeRequest(
            sendEntries,
            config,
            script,
            isHardwareSend,
          )

          if (!response?.result) {
            throw new Error('Rejected by RPC server.')
          }

          dispatch(
            showSuccessNotification({
              message:
                'Transaction pending! Your balance will automatically update when the blockchain has processed it.',
            }),
          )
          return resolve(config)
        } catch (err) {
          console.error({ err })
          return checkConfigForFees(config)
            .then(() => {
              rejectTransaction(`Transaction failed: ${err.message}`)
              return reject(err)
            })
            .catch(e => {
              rejectTransaction(`Transaction failed: ${e.message}`)
              return reject(e)
            })
        } finally {
          const hash = get(config, 'tx.hash')
          if (!isWatchOnly) {
            dispatch(
              addPendingTransaction.call({
                address: config.address,
                tx: {
                  hash,
                  sendEntries,
                },
                net,
              }),
            )
          }
        }
      })
}
