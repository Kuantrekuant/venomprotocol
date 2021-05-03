import { Contract, ContractFactory, Wallet, utils } from 'ethers'
import { BigNumberish } from 'ethers/utils'

export async function createLpToken(
  wallet: Wallet,
  factory: Contract,
  pairFactory: ContractFactory,
  tokenA: Contract,
  tokenB: Contract,
  amountA: BigNumberish,
  amountB: BigNumberish
): Promise<Contract> {
  const createPairTx = await factory.createPair(tokenA.address, tokenB.address)
  const pairAddress = (await createPairTx.wait()).events[0].args.pair
  const lpContract = await pairFactory.attach(pairAddress)

  await tokenA.transfer(lpContract.address, amountA)
  await tokenB.transfer(lpContract.address, amountB)

  await lpContract.mint(wallet.address)

  return lpContract
}
