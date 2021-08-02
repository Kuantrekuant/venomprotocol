import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'
import { advanceBlockTo, latestBlock } from '../shared/time'

import GovernanceToken from '../../build/GovernanceToken.json'

chai.use(solidity)

const TOTAL_CIRCULATING_SUPPLY = expandTo18Decimals(1000000)
const REGULAR_MINT_AMOUNT = expandTo18Decimals(20000)
const NO_MANUAL_MINTED = 0
const MANUAL_MINT_AMOUNT = expandTo18Decimals(999)
const TEST_AMOUNT = expandTo18Decimals(10)

const TOTAL_CAP = expandTo18Decimals(500000000)
const MANUAL_MINT_LIMIT = expandTo18Decimals(50000)
const LOCK_FROM_BLOCK = 100
const LOCK_TO_BLOCK = 200

describe('GovernanceToken::State', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [alice, bob] = provider.getWallets()

  let token: Contract
  beforeEach(async () => {
    token = await deployContract(alice, GovernanceToken, ["Viper", "VIPER", TOTAL_CAP, MANUAL_MINT_LIMIT, LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
    await token.mint(alice.address, TOTAL_CIRCULATING_SUPPLY)
  })

  it('should have correct values for: name, symbol, decimals, totalSupply, balanceOf', async () => {
    const name = await token.name()
    expect(name).to.eq('Viper')
    expect(await token.symbol()).to.eq('VIPER')
    expect(await token.decimals()).to.eq(18)
    expect(await token.totalSupply()).to.eq(TOTAL_CIRCULATING_SUPPLY)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY)
  })

  it('should have correct values for: cap, lockFromBlock, lockToBlock', async () => {
    expect(await token.cap()).to.eq(TOTAL_CAP)
    expect(await token.lockFromBlock()).to.eq(LOCK_FROM_BLOCK)
    expect(await token.lockToBlock()).to.eq(LOCK_TO_BLOCK)
  })
})
