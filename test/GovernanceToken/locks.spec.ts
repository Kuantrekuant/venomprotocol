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

describe('GovernanceToken::Locks', () => {
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

  it('should have correct values for: capUpdate, lockFromUpdate, lockToUpdate', async () => {
    await token.capUpdate(TOTAL_CAP.mul(expandTo18Decimals(2)))
    expect(await token.cap()).to.eq(TOTAL_CAP.mul(expandTo18Decimals(2)))

    await token.lockFromUpdate(LOCK_FROM_BLOCK+50)
    expect(await token.lockFromBlock()).to.eq(LOCK_FROM_BLOCK+50)

    await token.lockToUpdate(LOCK_TO_BLOCK+50)
    expect(await token.lockToBlock()).to.eq(LOCK_TO_BLOCK+50)
  })

  it('should have correct values for: unlockedSupply, lockedSupply, circulatingSupply, totalLock', async () => {
    expect(await token.unlockedSupply()).to.eq(TOTAL_CIRCULATING_SUPPLY)
    expect(await token.lockedSupply()).to.eq(0)
    expect(await token.circulatingSupply()).to.eq(TOTAL_CIRCULATING_SUPPLY)
    expect(await token.totalLock()).to.eq(0)
  })

  it('should be able to lock tokens', async () => {
    await expect(token.lock(alice.address, TEST_AMOUNT))
      .to.emit(token, 'Lock')
      .withArgs(alice.address, TEST_AMOUNT)
    expect(await token.lockOf(alice.address)).to.eq(TEST_AMOUNT)
    expect(await token.totalLock()).to.eq(TEST_AMOUNT)
  })

  it('should not be able to unlock without no prior locks set', async () => {
    await expect(token.unlock()).to.be.reverted
  })

  it('should be able to unlock tokens after the final vesting block', async () => {
    await expect(token.lock(alice.address, TEST_AMOUNT))
      .to.emit(token, 'Lock')
      .withArgs(alice.address, TEST_AMOUNT)
    
    expect(await token.lockOf(alice.address)).to.eq(TEST_AMOUNT)
    expect(await token.totalLock()).to.eq(TEST_AMOUNT)

    // The alice should now have the previously minted total supply - the locked amount
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.totalBalanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY)
    
    expect(await token.canUnlockAmount(alice.address)).to.eq(0)
    
    // Advance the blocks to 10 blocks past the final locking interval
    await advanceBlockTo(provider, LOCK_TO_BLOCK+10)

    expect(await token.canUnlockAmount(alice.address)).to.eq(TEST_AMOUNT)

    await expect(token.unlock())
      .to.emit(token, 'Transfer')
      .withArgs(token.address, alice.address, TEST_AMOUNT)
    
    const block = await latestBlock(provider)
    const lastUnlockBlock = await token.lastUnlockBlock(alice.address)
    expect(lastUnlockBlock.toNumber()).to.lte(block.number)
    
    expect(await token.lockOf(alice.address)).to.eq(0)
    expect(await token.totalLock()).to.eq(0)
    
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY)
    expect(await token.totalBalanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY)
  })

})
