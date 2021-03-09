import { Contract, ContractFactory, Wallet, utils } from 'ethers'
import { BigNumberish } from 'ethers/utils'

export async function createLpToken(
  wallet: Wallet,
  factory: Contract,
  pairFactory: ContractFactory,
  tokenA: Contract,
  tokenB: Contract,
  amount: BigNumberish
): Promise<Contract> {
  const createPairTx = await factory.createPair(tokenA.address, tokenB.address)
  const pairAddress = (await createPairTx.wait()).events[0].args.pair
  const lpContract = await pairFactory.attach(pairAddress)

  await tokenA.transfer(lpContract.address, amount)
  await tokenB.transfer(lpContract.address, amount)

  await lpContract.mint(wallet.address)

  return lpContract
}
