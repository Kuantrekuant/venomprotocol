import { Web3Provider } from 'ethers/providers'
import { Contract, Wallet, utils } from 'ethers'
import {
  BigNumber,
  bigNumberify,
  BigNumberish
} from 'ethers/utils'

import { latestBlock } from './time'

const BASE_TEN = 10

export function encodeParameters(types: any, values: any) {
  const abi = new utils.AbiCoder()
  return abi.encode(types, values)
}

export function expandTo18Decimals(n: number): BigNumber {
  return bigNumberify(n).mul(bigNumberify(10).pow(18))
}

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: BigNumberish, decimals: number = 18): BigNumber {
  return new BigNumber(amount).mul(new BigNumber(BASE_TEN).pow(decimals))
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [reserve1.mul(bigNumberify(2).pow(112)).div(reserve0), reserve0.mul(bigNumberify(2).pow(112)).div(reserve1)]
}

export async function humanBalance(
  provider: Web3Provider,
  token: Contract,
  method: string = 'balanceOf',
  address?: string | null | undefined,
  label?: string | null | undefined,
  log: boolean = true
) {
  const tokenName = await token.name()
  const tokenSymbol = await token.symbol()
  let balance: BigNumber = new BigNumber(0)
  const currentBlock = await latestBlock(provider)

  try {
    const args = (address) ? [address] : []
    balance = await token.functions[method](...args)
  } catch (error) {}

  let formattedBalance: string | undefined
  
  try {
    formattedBalance = utils.formatEther(balance.toString())
    label = (label) ? label : address
    label = (label) ? label : ''
  
    if (log) {
      console.log(`${tokenName}.${method}(${label}): ${formattedBalance} ${tokenSymbol} (block: ${currentBlock.number})\n`)
    }
  } catch (error) {}
  
  return formattedBalance
}
