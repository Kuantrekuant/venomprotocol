import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterHerpetologist } from './shared'

import ViperToken from '../../build/ViperToken.json'
import ERC20Mock from '../../build/ERC20Mock.json'

chai.use(solidity)

const LOCK_FROM_BLOCK = 250
const LOCK_TO_BLOCK = 500

// Referrals aren't actively used by the MasterHerpetologist contract - no automatic payouts will be handed out to the referrer on deposits & withdrawals
// The referral tracking system can be used for a later stage airdrop (e.g. airdropping funds from the community funds address to referrers) or other initiatives 
describe('MasterHerpetologist::Referrals', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let viperToken: Contract
  let lp: Contract
  let chef: Contract
  
  beforeEach(async () => {
    viperToken = await deployContract(alice, ViperToken, [LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
    
    lp = await deployContract(minter, ERC20Mock, ["LPToken", "LP", expandTo18Decimals(1000000)])
    await lp.transfer(alice.address, expandTo18Decimals(1000))
    await lp.transfer(bob.address, expandTo18Decimals(1000))
    await lp.transfer(carol.address, expandTo18Decimals(1000))

    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await viperToken.transferOwnership(chef.address)

    expect(await viperToken.totalSupply()).to.equal(0)

    await chef.add(rewardsPerBlock, lp.address, true)
  })

  it("should properly track referrals", async function () {    
    // Alice refers Bob who deposits
    await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))
    await chef.connect(bob).deposit(0, expandTo18Decimals(100), alice.address)

    // The contract should now keep track of Alice's referral
    let refValue = await chef.getRefValueOf(alice.address, bob.address)
    let globalRefValue = await chef.getGlobalRefAmount(alice.address)
    expect(refValue).to.eq(expandTo18Decimals(100))
    expect(globalRefValue).to.eq(expandTo18Decimals(100))
    expect(await chef.getTotalRefs(alice.address)).to.eq(1)

    // Alice now also refers Carol
    await lp.connect(carol).approve(chef.address, expandTo18Decimals(1000))
    await chef.connect(carol).deposit(0, expandTo18Decimals(100), alice.address)
    
    refValue = await chef.getRefValueOf(alice.address, carol.address)
    globalRefValue = await chef.getGlobalRefAmount(alice.address)
    expect(refValue).to.eq(expandTo18Decimals(100))
    expect(globalRefValue).to.eq(expandTo18Decimals(200))
    expect(await chef.getTotalRefs(alice.address)).to.eq(2)

    // calculate the user's deposit
    let userDepositFee = await chef.userDepFee()
    let likelyDeposit = expandTo18Decimals(10).sub(expandTo18Decimals(10).mul(userDepositFee).div(10000))
    await chef.connect(bob).withdraw(0, likelyDeposit, alice.address)

    // Bob withdraws from the pool and Alice's referral value/score should be lowered as a consequence
    expect(await chef.getRefValueOf(alice.address, bob.address)).to.lt(refValue)
    expect(await chef.getGlobalRefAmount(alice.address)).to.lt(globalRefValue)

    // Total referrals should still remain intact
    expect(await chef.getTotalRefs(alice.address)).to.eq(2)
  })
})
