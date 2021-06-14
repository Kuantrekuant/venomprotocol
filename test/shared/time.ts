import { Web3Provider } from 'ethers/providers'
import {
  BigNumber,
  BigNumberish
} from 'ethers/utils'

export async function advanceBlock(provider: Web3Provider) {
  return provider.send("evm_mine", [])
}

export async function advanceBlockTo(provider: Web3Provider, blockNumber: number) {
  for (let i = await provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock(provider)
  }
}

export async function advanceBlockWith(provider: Web3Provider, blockCount: number) {
  const currentBlockNumber = await provider.getBlockNumber()
  const newBlockNumber = currentBlockNumber + blockCount
  await advanceBlockTo(provider, newBlockNumber)
}

export async function increase(provider: Web3Provider, value: number) {
  await provider.send("evm_increaseTime", [value])
  await advanceBlock(provider)
}

export async function latestBlock(provider: Web3Provider) {
  return provider.getBlock("latest")
  //return new BigNumber(block.timestamp)
}

export async function latest(provider: Web3Provider) {
  const block = await provider.getBlock("latest")
  return new BigNumber(block.timestamp)
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
