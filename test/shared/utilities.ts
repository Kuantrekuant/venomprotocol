import { Web3Provider } from 'ethers/providers'
import { Contract, Wallet, utils } from 'ethers'
import {
  BigNumber,
  bigNumberify,
  BigNumberish
} from 'ethers/utils'

const BASE_TEN = 10

export function expandTo18Decimals(n: number): BigNumber {
  return bigNumberify(n).mul(bigNumberify(10).pow(18))
}

export async function advanceBlock(provider: Web3Provider) {
  return provider.send("evm_mine", [])
}

export async function advanceBlockTo(provider: Web3Provider, blockNumber: number) {
  for (let i = await provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock(provider)
  }
}

export async function increase(provider: Web3Provider, value: number) {
  await provider.send("evm_increaseTime", [value])
  await advanceBlock(provider)
}

export async function latestBlock(provider: Web3Provider) {
  return provider.getBlock("latest")
  //return new BigNumber(block.timestamp)
}

export const duration = {
  seconds: function (val: BigNumberish) {
    return new BigNumber(val)
  },
  minutes: function (val: BigNumberish) {
    return new BigNumber(val).mul(this.seconds("60"))
  },
  hours: function (val: BigNumberish) {
    return new BigNumber(val).mul(this.minutes("60"))
  },
  days: function (val: BigNumberish) {
    return new BigNumber(val).mul(this.hours("24"))
  },
  weeks: function (val: BigNumberish) {
    return new BigNumber(val).mul(this.days("7"))
  },
  years: function (val: BigNumberish) {
    return new BigNumber(val).mul(this.days("365"))
  },
}

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: BigNumberish, decimals: number = 18): BigNumber {
  return new BigNumber(amount).mul(new BigNumber(BASE_TEN).pow(decimals))
}

export async function mineBlock(provider: Web3Provider, timestamp: number): Promise<void> {
  await new Promise(async (resolve, reject) => {
    ;(provider._web3Provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] },
      (error: any, result: any): void => {
        console.log({error, result})
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

export async function increaseTime(provider: Web3Provider, duration: number): Promise<void> {
  const id = Date.now()

  await new Promise(async (resolve, reject) => {
    ;(provider._web3Provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'evm_increaseTime', params: [duration], id: id },
      (err1: any): void => {
        console.log({err1})
        if (err1) reject(err1)

        ;(provider._web3Provider.sendAsync as any)(
        { jsonrpc: '2.0', method: 'evm_mine', params: [], id: id + 1 },
        (err2: any, res: any): void => {
          console.log({err2, res})
          err2 ? reject(err2) : resolve(res)
        })
      }
    )
  })
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
