import chai, { expect } from 'chai'
import { Contract, utils } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, humanBalance } from '../shared/utilities'
import { advanceBlockTo, advanceBlockWith, latestBlock } from '../shared/time'

import { deployMasterBreeder, deployGovernanceToken, TOKEN_NAME, TOKEN_SYMBOL, TOTAL_CAP, MANUAL_MINT_LIMIT } from '../shared/deploy'

import ERC20Mock from '../../build/ERC20Mock.json'

chai.use(solidity)

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// Viper token locks
const LOCK_FROM_BLOCK = 250
const LOCK_TO_BLOCK = 500

// MasterBreeder halving settings
// The block count value should represent one week's worth of blocks on whatever network the contracts are deployed on
// Ethereum: ~45361
// BSC: ~201600
// Harmony: ~302400
// For testing use 250
// const HALVING_AFTER_BLOCK_COUNT = 45361

describe('MasterBreeder::Rewards', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let govToken: Contract
  
  beforeEach(async () => {
    govToken = await deployGovernanceToken(alice, TOKEN_NAME, TOKEN_SYMBOL, TOTAL_CAP, MANUAL_MINT_LIMIT, LOCK_FROM_BLOCK, LOCK_TO_BLOCK)
  })

  context("Entering & withdrawing from pools + claiming rewards", function () {
    let lp: Contract
    let lp2: Contract

    beforeEach(async function () {
      lp = await deployContract(minter, ERC20Mock, ["LPToken", "LP", expandTo18Decimals(1000000)])
      await lp.transfer(alice.address, expandTo18Decimals(1000))
      await lp.transfer(bob.address, expandTo18Decimals(1000))
      await lp.transfer(carol.address, expandTo18Decimals(1000))

      lp2 = await deployContract(minter, ERC20Mock, ["LPToken2", "LP2", expandTo18Decimals(1000000)])
      await lp2.transfer(alice.address, expandTo18Decimals(1000))
      await lp2.transfer(bob.address, expandTo18Decimals(1000))
      await lp2.transfer(carol.address, expandTo18Decimals(1000))
    })

    it("should not pay out VIPER rewards before farming has started", async function () {
      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const rewardsStartAtBlock = 100
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

      await govToken.transferOwnership(breeder.address)

      expect(await govToken.totalSupply()).to.equal(0)

      await breeder.add(rewardsPerBlock, lp.address, true)

      expect(await govToken.totalSupply()).to.equal(0)

      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))

      // 0 amount deposits will be reverted
      await expect(breeder.connect(bob).deposit(0, 0, ZERO_ADDRESS)).to.be.reverted

      await breeder.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      expect(await govToken.totalSupply()).to.equal(0)
      
      await breeder.connect(bob).claimReward(0)
      expect(await govToken.totalSupply()).to.equal(0)
      expect(await govToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(0))
    })

    it("should pay out VIPER rewards after farming has started", async function () {
      this.timeout(0)
      const debugMessages = false

      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const rewardsStartAtBlock = 100
      const rewardsMultiplierForSecondPool = 5
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

      await govToken.transferOwnership(breeder.address)

      expect(await govToken.totalSupply()).to.equal(0)

      await breeder.add(rewardsPerBlock, lp.address, true)

      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
      await breeder.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      // Advance to the start of the rewards period
      await advanceBlockTo(provider, rewardsStartAtBlock)
      
      const currentBlock = await latestBlock(provider)
      const activeMultiplier = await breeder.getMultiplier(currentBlock.number, currentBlock.number+1)
      const firstMultiplier = await breeder.REWARD_MULTIPLIER(0)
      expect(activeMultiplier).to.equal(firstMultiplier)

      const rewardPerBlock = await breeder.REWARD_PER_BLOCK()
      expect(rewardPerBlock).to.equal(rewardPerBlock)

      // block ~101 - rewards have started & locking period has started
      // 95% rewards should now be locked until block 500
      await expect(breeder.connect(bob).claimReward(0))
        .to.emit(breeder, 'SendGovernanceTokenReward') // emit SendGovernanceTokenReward(msg.sender, _pid, pending, lockAmount);
        .withArgs(bob.address, 0, '254080000000000000000', '241376000000000000000')
      
      if (debugMessages) humanBalance(provider, govToken, 'totalSupply')
      const totalSupplyAfterBobClaim = await govToken.totalSupply()
      expect(totalSupplyAfterBobClaim).to.equal('307200000000000000000')

      const { forDev, forFarmer, forLP, forCom, forFounders } = await breeder.getPoolReward(currentBlock.number, currentBlock.number+1, rewardsPerBlock)
      //console.log({forDev, forFarmer, forLP, forCom, forFounders})
      expect(totalSupplyAfterBobClaim).to.equal(forDev.add(forFarmer).add(forLP).add(forCom).add(forFounders))

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      let bobBalanceOf = await govToken.balanceOf(bob.address)
      expect(bobBalanceOf).to.equal('12704000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      let bobLockOf = await govToken.lockOf(bob.address)
      expect(bobLockOf).to.eq('241376000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      let bobTotalBalanceOf = await govToken.totalBalanceOf(bob.address)
      expect(bobTotalBalanceOf).to.equal('254080000000000000000')

      // block ~102 - add new pool + Carol deposits
      await breeder.add(rewardsPerBlock*rewardsMultiplierForSecondPool, lp2.address, true) //5x bonus rewards pool vs pool 0
      await lp2.connect(carol).approve(breeder.address, expandTo18Decimals(1000))
      await breeder.connect(carol).deposit(1, expandTo18Decimals(100), ZERO_ADDRESS)

      // she should have two times (two sets of rewards since we're at block 102) 5x (=10x) of Bob's block 101 rewards
      await expect(breeder.connect(carol).claimReward(1))
        .to.emit(breeder, 'SendGovernanceTokenReward') // emit SendGovernanceTokenReward(msg.sender, _pid, pending, lockAmount);
        .withArgs(carol.address, 1, '211733333333300250000', '201146666666635237500')
    
      // After Carol has claimed her rewards
      if (debugMessages) humanBalance(provider, govToken, 'totalSupply')
      expect(await govToken.totalSupply()).to.gt(totalSupplyAfterBobClaim)

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', carol.address, 'carol.address')
      expect(await govToken.balanceOf(carol.address)).to.lt(bobBalanceOf)

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', carol.address, 'carol.address')
      expect(await govToken.lockOf(carol.address)).to.lt(bobLockOf)

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', carol.address, 'carol.address')
      expect(await govToken.totalBalanceOf(carol.address)).to.lt(bobTotalBalanceOf)

      // Bob now joins pool 2 in order to verify that he can claim from all pools at once
      await lp2.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
      await breeder.connect(bob).deposit(1, expandTo18Decimals(100), ZERO_ADDRESS)

      // Advance 10 blocks, then claim rewards from all pools
      advanceBlockWith(provider, 10)
      await breeder.connect(bob).claimRewards([0, 1])

      expect('claimReward').to.be.calledOnContractWith(breeder, [0]);
      expect('claimReward').to.be.calledOnContractWith(breeder, [1]);

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      bobBalanceOf = await govToken.balanceOf(bob.address)
      expect(bobBalanceOf).to.equal('50815999999995037500')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      bobLockOf = await govToken.lockOf(bob.address)
      expect(bobLockOf).to.eq('965503999999905712500')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      bobTotalBalanceOf = await govToken.totalBalanceOf(bob.address)
      expect(bobTotalBalanceOf).to.equal('1016319999999900750000')
    })

    it("should allow the user to claim & unlock rewards according to the rewards unlocking schedule", async function () {
      this.timeout(0)
      const debugMessages = false

      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const rewardsStartAtBlock = 150
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

      await govToken.transferOwnership(breeder.address)

      expect(await govToken.totalSupply()).to.equal(0)

      await breeder.add(rewardsPerBlock, lp.address, true)
      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
      await breeder.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      // Advance to the start of the rewards period + 1 block
      await advanceBlockTo(provider, rewardsStartAtBlock + 1)

      // block ~101 - rewards have started & locking period has started
      // 95% rewards should now be locked until block 500

      await expect(breeder.connect(bob).claimReward(0))
        .to.emit(breeder, 'SendGovernanceTokenReward') // emit SendGovernanceTokenReward(msg.sender, _pid, pending, lockAmount);
        .withArgs(bob.address, 0, '508160000000000000000', '482752000000000000000')
      
      expect(await govToken.totalSupply()).to.equal('614400000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('25408000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('482752000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('508160000000000000000')

      // community, developer, founder & lp reward funds should now have been rewarded with tokens
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', dev.address, 'dev.address')
      expect(await govToken.balanceOf(dev.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', liquidityFund.address, 'liquidityFund.address')
      expect(await govToken.balanceOf(liquidityFund.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', communityFund.address, 'communityFund.address')
      expect(await govToken.balanceOf(communityFund.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', founderFund.address, 'founderFund.address')
      expect(await govToken.balanceOf(founderFund.address)).to.gt(0)

      // Advance to the start of the locking period + 1 block
      await advanceBlockTo(provider, LOCK_FROM_BLOCK+1)

      // Balances should still remain the same...
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('25408000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('482752000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('508160000000000000000')

      // Advance to the end of the lock period - 50 blocks
      // User should now be able to claim even more of the locked rewards
      await advanceBlockTo(provider, LOCK_TO_BLOCK-50)
      await expect(govToken.connect(bob).unlock())
        .to.emit(govToken, 'Transfer')
        .withArgs(govToken.address, bob.address, '388132608000000000000')
      
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('413540608000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('508160000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('94619392000000000000')

      // Advance to the end of the lock period + 10 blocks
      await advanceBlockTo(provider, LOCK_TO_BLOCK+10)

      // We haven't called unlock() yet - balances should remain the same
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('413540608000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('508160000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('94619392000000000000')

      expect(await govToken.canUnlockAmount(bob.address)).to.eq('94619392000000000000')

      await expect(govToken.connect(bob).unlock())
        .to.emit(govToken, 'Transfer')
        .withArgs(govToken.address, bob.address, '94619392000000000000')
      
      const currentBlock = await latestBlock(provider)
      const lastUnlockBlock = await govToken.lastUnlockBlock(bob.address)
      expect(lastUnlockBlock.toNumber()).to.lte(currentBlock.number)
      
      // unlock() has been called - bob should now have 0 locked tokens & 100% unlocked tokens
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('508160000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('508160000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('0')

      if (debugMessages) humanBalance(provider, govToken, 'totalLock')
      expect(await govToken.totalLock()).to.eq('77824000000000000000')
    })

    it("should not distribute VIPERs if no one deposit", async function () {
      this.timeout(0)
      const debugMessages = false
      // 1 per block farming rate starting at block 600 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), 600, 1000)
      await govToken.transferOwnership(breeder.address)
      await breeder.add(rewardsPerBlock, lp.address, true)
      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))

      await advanceBlockTo(provider, 599)
      expect(await govToken.totalSupply()).to.equal(0) // block 600

      await advanceBlockTo(provider, 604)
      // block 605:
      expect(await govToken.totalSupply()).to.equal(0) // block 605

      await advanceBlockTo(provider, 609)
      // block 610: 
      await expect(breeder.connect(bob).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)) 
        .to.emit(breeder, 'Deposit') //emit Deposit(msg.sender, _pid, _amount);
        .withArgs(bob.address, 0, expandTo18Decimals(10))
      
      expect(await govToken.totalSupply()).to.equal(0)
      expect(await govToken.balanceOf(bob.address)).to.equal(0)
      expect(await govToken.balanceOf(dev.address)).to.equal(0)
      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals((990)))
      
      await advanceBlockTo(provider, 619)
      // block 620:
      // since there's a deposit fee a user can't withdraw the exact same amount they originally deposited
      await expect(breeder.connect(bob).withdraw(0, expandTo18Decimals(10), ZERO_ADDRESS)).to.be.reverted

      // calculate the user's deposit
      const userDepositFee = await breeder.userDepFee()
      const likelyDeposit = expandTo18Decimals(10).sub(expandTo18Decimals(10).mul(userDepositFee).div(10000))
      if (debugMessages) console.log('Likely deposit balance (after fees)', utils.formatEther(likelyDeposit.toString()))

      await expect(breeder.connect(bob).withdraw(0, likelyDeposit, ZERO_ADDRESS)) 
        .to.emit(breeder, 'Withdraw') //emit Withdraw(msg.sender, _pid, _amount);
        .withArgs(bob.address, 0, likelyDeposit)
      
      if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
      expect(await govToken.balanceOf(bob.address)).to.equal('127040000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
      expect(await govToken.lockOf(bob.address)).to.eq('2413760000000000000000')

      if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await govToken.totalBalanceOf(bob.address)).to.equal('2540800000000000000000')

      expect(await govToken.totalSupply()).to.equal('3072000000000000000000')
      expect(await lp.balanceOf(bob.address)).to.gte(likelyDeposit)
    })

    it("should distribute VIPERs properly for each staker"), async () => {
      // 1 per block farming rate starting at block 300 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), 300, 1000)

      await govToken.transferOwnership(breeder.address)
      await breeder.add(rewardsPerBlock, lp.address, true)
      await lp.connect(alice).approve(breeder.address, expandTo18Decimals(1000))
      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
      await lp.connect(carol).approve(breeder.address, expandTo18Decimals(1000))
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo(provider, 309)
      await breeder.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo(provider, 313)
      await breeder.connect(bob).deposit(0, expandTo18Decimals(20), ZERO_ADDRESS)
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo(provider, 317)
      await breeder.connect(carol).deposit(0, expandTo18Decimals(30), ZERO_ADDRESS)
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
      //   MasterChef should have the remaining: 10000 - 5666 = 4334
      await advanceBlockTo(provider, 319)
      await breeder.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      expect(await govToken.totalSupply()).to.equal(expandTo18Decimals(11000))
      expect(await govToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(5666))
      expect(await govToken.balanceOf(bob.address)).to.equal(0)
      expect(await govToken.balanceOf(carol.address)).to.equal(0)
      expect(await govToken.balanceOf(breeder.address)).to.equal(expandTo18Decimals(4334))
      expect(await govToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(1000))
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
      await advanceBlockTo(provider, 329)
      await breeder.connect(bob).withdraw(0, expandTo18Decimals(5), ZERO_ADDRESS)
      expect(await govToken.totalSupply()).to.equal(expandTo18Decimals(22000))
      expect(await govToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(5666))
      expect(await govToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(6190))
      expect(await govToken.balanceOf(carol.address)).to.equal(0)
      expect(await govToken.balanceOf(breeder.address)).to.equal(expandTo18Decimals(8144))
      expect(await govToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(2000))
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo(provider, 339)
      await breeder.connect(alice).withdraw(0, expandTo18Decimals(20), ZERO_ADDRESS)
      await advanceBlockTo(provider, 349)
      await breeder.connect(bob).withdraw(0, expandTo18Decimals(15), ZERO_ADDRESS)
      await advanceBlockTo(provider, 359)
      await breeder.connect(carol).withdraw(0, expandTo18Decimals(30), ZERO_ADDRESS)
      expect(await govToken.totalSupply()).to.equal(expandTo18Decimals(55000))
      expect(await govToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(5000))
      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await govToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(11600))
      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await govToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(11831))
      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await govToken.balanceOf(carol.address)).to.equal(expandTo18Decimals(26568))
      // All of them should have 1000 LPs back.
      expect(await lp.balanceOf(alice.address)).to.equal(expandTo18Decimals(1000))
      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals(1000))
      expect(await lp.balanceOf(carol.address)).to.equal(expandTo18Decimals(1000))
    }

    it("should give proper VIPERs allocation to each pool"), async () => {
      // 100 per block farming rate starting at block 400 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), 400, 1000)

      await govToken.transferOwnership(breeder.address)
      await lp.connect(alice).approve(breeder.address, expandTo18Decimals(1000))
      await lp2.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
      // Add first LP to the pool with allocation 1
      await breeder.add(rewardsPerBlock, lp.address, true)
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo(provider, 409)
      await breeder.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo(provider, 419)
      await breeder.add(rewardsPerBlock*2, lp2.address, true) // 2x bonus
      // Alice should have 10*1000 pending reward
      expect(await breeder.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(10000))
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo(provider, 424)
      await breeder.connect(bob).deposit(1, expandTo18Decimals(5), ZERO_ADDRESS)
      // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
      expect(await breeder.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(11666))
      await advanceBlockTo(provider, 430)
      // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
      expect(await breeder.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(13333))
      expect(await breeder.pendingReward(1, bob.address)).to.equal(expandTo18Decimals(3333))
    }
  })

})
