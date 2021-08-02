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

describe('GovernanceToken::Transfers', () => {
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

  it('should be able to approve an address + balance', async () => {
    await expect(token.approve(bob.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(alice.address, bob.address, TEST_AMOUNT)
    expect(await token.allowance(alice.address, bob.address)).to.eq(TEST_AMOUNT)
  })

  it('should be able to transfer', async () => {
    await expect(token.transfer(bob.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(alice.address, bob.address, TEST_AMOUNT)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(bob.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer should fail', async () => {
    await expect(token.transfer(bob.address, TOTAL_CIRCULATING_SUPPLY.add(1))).to.be.reverted // ds-math-sub-underflow
    await expect(token.connect(bob).transfer(alice.address, 1)).to.be.reverted // ds-math-sub-underflow
  })

  it('should be able to transferFrom one address to an address', async () => {
    await token.approve(bob.address, TEST_AMOUNT)
    await expect(token.connect(bob).transferFrom(alice.address, bob.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(alice.address, bob.address, TEST_AMOUNT)
    expect(await token.allowance(alice.address, bob.address)).to.eq(0)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(bob.address)).to.eq(TEST_AMOUNT)
  })

  /*it('transferFrom:max', async () => {
    await token.approve(bob.address, MaxUint256)
    await expect(token.connect(bob).transferFrom(alice.address, bob.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(alice.address, bob.address, TEST_AMOUNT)
    expect(await token.allowance(alice.address, bob.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.sub(TEST_AMOUNT))
    expect(await token.balanceOf(bob.address)).to.eq(TEST_AMOUNT)
  })*/

})
