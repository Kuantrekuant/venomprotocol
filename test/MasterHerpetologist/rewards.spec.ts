import chai, { expect } from 'chai'
import { Contract, utils } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, advanceBlockTo, latestBlock, humanBalance } from '../shared/utilities'

import { deployMasterHerpetologist } from './shared'

import ViperToken from '../../build/ViperToken.json'
import ERC20Mock from '../../build/ERC20Mock.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// ViperToken locks
const LOCK_FROM_BLOCK = 250
const LOCK_TO_BLOCK = 500

// MasterHerpetologist halving settings
// The block count value should represent one week's worth of blocks on whatever network the contracts are deployed on
// Ethereum: ~45361
// BSC: ~201600
// Harmony: ~302400
// For testing use 250
const HALVING_AFTER_BLOCK_COUNT = 45361

describe('MasterHerpetologist::Rewards', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let viperToken: Contract
  
  beforeEach(async () => {
    viperToken = await deployContract(alice, ViperToken, [LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
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

    it("should allow emergency withdraw", async function () {
      this.timeout(0)
      // 100 per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(100), 100, 1000)

      await chef.add(100, lp.address, true)

      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))

      await chef.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals(900))

      // Even for emergency withdraws there are still withdrawal penalties applied
      // Bob will end up with 975 tokens
      // Dev address should now hold 25 tokens
      await chef.connect(bob).emergencyWithdraw(0)

      expect(await lp.balanceOf(bob.address)).to.equal('974437500000000000000')
      expect(await lp.balanceOf(dev.address)).to.equal('24812500000000000000')
    })

    it("should not pay out VIPER rewards before farming has started", async function () {
      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = expandTo18Decimals(1)
      const rewardsStartAtBlock = 100
      const chef = await deployMasterHerpetologist(wallets, viperToken, rewardsPerBlock, rewardsStartAtBlock, 1000)

      await viperToken.transferOwnership(chef.address)

      expect(await viperToken.totalSupply()).to.equal(0)

      await chef.add(32000, lp.address, true)

      expect(await viperToken.totalSupply()).to.equal(0)

      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))

      // 0 amount deposits will be reverted
      await expect(chef.connect(bob).deposit(0, 0, ZERO_ADDRESS)).to.be.reverted

      await chef.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      expect(await viperToken.totalSupply()).to.equal(0)
      
      await chef.connect(bob).claimReward(0)
      expect(await viperToken.totalSupply()).to.equal(0)
      expect(await viperToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(0))
    })

    it("should pay out VIPER rewards after farming has started", async function () {
      this.timeout(0)
      const debugMessages = false

      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = expandTo18Decimals(1)
      const rewardsStartAtBlock = 100
      const chef = await deployMasterHerpetologist(wallets, viperToken, rewardsPerBlock, rewardsStartAtBlock, 1000)

      await viperToken.transferOwnership(chef.address)

      expect(await viperToken.totalSupply()).to.equal(0)

      await chef.add(32000, lp.address, true)
      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))
      await chef.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      // Advance to the start of the rewards period + 1 block
      await advanceBlockTo(provider, rewardsStartAtBlock + 1)

      // block ~101 - rewards have started & locking period has started
      // 95% rewards should now be locked until block 500

      await expect(chef.connect(bob).claimReward(0))
        .to.emit(chef, 'SendViperReward') // emit SendViperReward(msg.sender, _pid, pending, lockAmount);
        .withArgs(bob.address, 0, '8130560000000000000000', '7724032000000000000000')
      
      expect(await viperToken.totalSupply()).to.equal('9830400000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('406528000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('7724032000000000000000')
    })

    it("should allow the user to claim & unlock rewards according to the rewards unlocking schedule", async function () {
      this.timeout(0)
      const debugMessages = false

      // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = expandTo18Decimals(1)
      const rewardsStartAtBlock = 150
      const chef = await deployMasterHerpetologist(wallets, viperToken, rewardsPerBlock, rewardsStartAtBlock, 1000)

      await viperToken.transferOwnership(chef.address)

      expect(await viperToken.totalSupply()).to.equal(0)

      await chef.add(32000, lp.address, true)
      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))
      await chef.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      // Advance to the start of the rewards period + 1 block
      await advanceBlockTo(provider, rewardsStartAtBlock + 1)

      // block ~101 - rewards have started & locking period has started
      // 95% rewards should now be locked until block 500

      await expect(chef.connect(bob).claimReward(0))
        .to.emit(chef, 'SendViperReward') // emit SendViperReward(msg.sender, _pid, pending, lockAmount);
        .withArgs(bob.address, 0, '8130560000000000000000', '7724032000000000000000')
      
      expect(await viperToken.totalSupply()).to.equal('9830400000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('406528000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('7724032000000000000000')

      // community, developer, founder & lp reward funds should now have been rewarded with tokens
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', dev.address, 'dev.address')
      expect(await viperToken.balanceOf(dev.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', liquidityFund.address, 'liquidityFund.address')
      expect(await viperToken.balanceOf(liquidityFund.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', communityFund.address, 'communityFund.address')
      expect(await viperToken.balanceOf(communityFund.address)).to.gt(0)

      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', founderFund.address, 'founderFund.address')
      expect(await viperToken.balanceOf(founderFund.address)).to.gt(0)

      // Advance to the start of the locking period + 1 block
      await advanceBlockTo(provider, LOCK_FROM_BLOCK+1)

      // Balances should still remain the same...
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('406528000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('7724032000000000000000')

      // Advance to the end of the lock period - 50 blocks
      // User should now be able to claim even more of the locked rewards
      await advanceBlockTo(provider, LOCK_TO_BLOCK-50)
      await expect(viperToken.connect(bob).unlock())
        .to.emit(viperToken, 'Transfer')
        .withArgs(viperToken.address, bob.address, '6210121728000000000000')
      
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('6616649728000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('1513910272000000000000')

      // Advance to the end of the lock period + 10 blocks
      await advanceBlockTo(provider, LOCK_TO_BLOCK+10)

      // We haven't called unlock() yet - balances should remain the same
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('6616649728000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('1513910272000000000000')

      expect(await viperToken.canUnlockAmount(bob.address)).to.eq('1513910272000000000000')

      await expect(viperToken.connect(bob).unlock())
        .to.emit(viperToken, 'Transfer')
        .withArgs(viperToken.address, bob.address, '1513910272000000000000')
      
      const currentBlock = await latestBlock(provider)
      const lastUnlockBlock = await viperToken.lastUnlockBlock(bob.address)
      expect(lastUnlockBlock.toNumber()).to.lte(currentBlock.number)
      
      // unlock() has been called - bob should now have 0 locked tokens & 100% unlocked tokens
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('8130560000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('0')

      if (debugMessages) humanBalance(provider, viperToken, 'totalLock')
      expect(await viperToken.totalLock()).to.eq('1245184000000000000000')
    })

    it("should not distribute VIPERs if no one deposit", async function () {
      this.timeout(0)
      const debugMessages = false
      // 100 per block farming rate starting at block 600 with the first halvening block starting 1000 blocks after the start block
      const chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(1), 600, 1000)
      await viperToken.transferOwnership(chef.address)
      await chef.add(100, lp.address, true)
      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))

      await advanceBlockTo(provider, 599)
      expect(await viperToken.totalSupply()).to.equal(0) // block 600

      await advanceBlockTo(provider, 604)
      // block 605:
      expect(await viperToken.totalSupply()).to.equal(0) // block 605

      await advanceBlockTo(provider, 609)
      // block 610: 
      await expect(chef.connect(bob).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)) 
        .to.emit(chef, 'Deposit') //emit Deposit(msg.sender, _pid, _amount);
        .withArgs(bob.address, 0, expandTo18Decimals(10))
      
      expect(await viperToken.totalSupply()).to.equal(0)
      expect(await viperToken.balanceOf(bob.address)).to.equal(0)
      expect(await viperToken.balanceOf(dev.address)).to.equal(0)
      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals((990)))
      
      await advanceBlockTo(provider, 619)
      // block 620:
      // since there's a deposit fee a user can't withdraw the exact same amount they originally deposited
      await expect(chef.connect(bob).withdraw(0, expandTo18Decimals(10), ZERO_ADDRESS)).to.be.reverted

      // calculate the user's deposit
      const userDepositFee = await chef.userDepFee()
      const likelyDeposit = expandTo18Decimals(10).sub(expandTo18Decimals(10).mul(userDepositFee).div(10000))
      if (debugMessages) console.log('Likely deposit balance (after fees)', utils.formatEther(likelyDeposit.toString()))

      await expect(chef.connect(bob).withdraw(0, likelyDeposit, ZERO_ADDRESS)) 
        .to.emit(chef, 'Withdraw') //emit Withdraw(msg.sender, _pid, _amount);
        .withArgs(bob.address, 0, likelyDeposit)
      
      if (debugMessages) humanBalance(provider, viperToken, 'balanceOf', bob.address, 'bob.address')
      expect(await viperToken.balanceOf(bob.address)).to.equal('2032640000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'totalBalanceOf', bob.address, 'bob.address')
      expect(await viperToken.totalBalanceOf(bob.address)).to.equal('40652800000000000000000')

      if (debugMessages) humanBalance(provider, viperToken, 'lockOf', bob.address, 'bob.address')
      expect(await viperToken.lockOf(bob.address)).to.eq('38620160000000000000000')

      expect(await viperToken.totalSupply()).to.equal(expandTo18Decimals(49152))
      expect(await lp.balanceOf(bob.address)).to.gte(likelyDeposit)
    })

    it("should distribute VIPERs properly for each staker"), async () => {
      // 100 per block farming rate starting at block 300 with the first halvening block starting 1000 blocks after the start block
      const chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(100), 300, 1000)

      await viperToken.transferOwnership(chef.address)
      await chef.add(100, lp.address, true)
      await lp.connect(alice).approve(chef.address, expandTo18Decimals(1000))
      await lp.connect(bob).approve(chef.address, expandTo18Decimals(1000))
      await lp.connect(carol).approve(chef.address, expandTo18Decimals(1000))
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo(provider, 309)
      await chef.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo(provider, 313)
      await chef.connect(bob).deposit(0, expandTo18Decimals(20), ZERO_ADDRESS)
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo(provider, 317)
      await chef.connect(carol).deposit(0, expandTo18Decimals(30), ZERO_ADDRESS)
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
      //   MasterChef should have the remaining: 10000 - 5666 = 4334
      await advanceBlockTo(provider, 319)
      await chef.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      expect(await viperToken.totalSupply()).to.equal(expandTo18Decimals(11000))
      expect(await viperToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(5666))
      expect(await viperToken.balanceOf(bob.address)).to.equal(0)
      expect(await viperToken.balanceOf(carol.address)).to.equal(0)
      expect(await viperToken.balanceOf(chef.address)).to.equal(expandTo18Decimals(4334))
      expect(await viperToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(1000))
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
      await advanceBlockTo(provider, 329)
      await chef.connect(bob).withdraw(0, expandTo18Decimals(5), ZERO_ADDRESS)
      expect(await viperToken.totalSupply()).to.equal(expandTo18Decimals(22000))
      expect(await viperToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(5666))
      expect(await viperToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(6190))
      expect(await viperToken.balanceOf(carol.address)).to.equal(0)
      expect(await viperToken.balanceOf(chef.address)).to.equal(expandTo18Decimals(8144))
      expect(await viperToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(2000))
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo(provider, 339)
      await chef.connect(alice).withdraw(0, expandTo18Decimals(20), ZERO_ADDRESS)
      await advanceBlockTo(provider, 349)
      await chef.connect(bob).withdraw(0, expandTo18Decimals(15), ZERO_ADDRESS)
      await advanceBlockTo(provider, 359)
      await chef.connect(carol).withdraw(0, expandTo18Decimals(30), ZERO_ADDRESS)
      expect(await viperToken.totalSupply()).to.equal(expandTo18Decimals(55000))
      expect(await viperToken.balanceOf(dev.address)).to.equal(expandTo18Decimals(5000))
      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await viperToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(11600))
      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await viperToken.balanceOf(bob.address)).to.equal(expandTo18Decimals(11831))
      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await viperToken.balanceOf(carol.address)).to.equal(expandTo18Decimals(26568))
      // All of them should have 1000 LPs back.
      expect(await lp.balanceOf(alice.address)).to.equal(expandTo18Decimals(1000))
      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals(1000))
      expect(await lp.balanceOf(carol.address)).to.equal(expandTo18Decimals(1000))
    }

    it("should give proper VIPERs allocation to each pool"), async () => {
      // 100 per block farming rate starting at block 400 with the first halvening block starting 1000 blocks after the start block
      const chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(100), 400, 1000)

      await viperToken.transferOwnership(chef.address)
      await lp.connect(alice).approve(chef.address, expandTo18Decimals(1000))
      await lp2.connect(bob).approve(chef.address, expandTo18Decimals(1000))
      // Add first LP to the pool with allocation 1
      await chef.add(10, lp.address, true)
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo(provider, 409)
      await chef.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo(provider, 419)
      await chef.add(20, lp2.address, true)
      // Alice should have 10*1000 pending reward
      expect(await chef.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(10000))
      // Bob deposits 10 LP2s at block 425
      await advanceBlockTo(provider, 424)
      await chef.connect(bob).deposit(1, expandTo18Decimals(5), ZERO_ADDRESS)
      // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
      expect(await chef.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(11666))
      await advanceBlockTo(provider, 430)
      // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
      expect(await chef.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(13333))
      expect(await chef.pendingReward(1, bob.address)).to.equal(expandTo18Decimals(3333))
    }

    it("should stop giving bonus VIPERs after the bonus period ends"), async () => {
      // 100 per block farming rate starting at block 500 with the first halvening block starting 600 blocks after the start block
      const chef = await deployMasterHerpetologist(wallets, viperToken, expandTo18Decimals(100), 500, 600)

      await viperToken.transferOwnership(chef.address)
      await lp.connect(alice).approve(chef.address, expandTo18Decimals(1000))
      await chef.add(1, lp.address, true)
      // Alice deposits 10 LPs at block 590
      await advanceBlockTo(provider, 589)
      await chef.connect(alice).deposit(0, expandTo18Decimals(10), ZERO_ADDRESS)
      // At block 605, she should have 1000*10 + 100*5 = 10500 pending.
      await advanceBlockTo(provider, 605)
      expect(await chef.pendingReward(0, alice.address)).to.equal(expandTo18Decimals(10500))
      // At block 606, Alice withdraws all pending rewards and should get 10600.
      await chef.connect(alice).deposit(0, 0, ZERO_ADDRESS)
      expect(await chef.pendingReward(0, alice.address)).to.equal(0)
      expect(await viperToken.balanceOf(alice.address)).to.equal(expandTo18Decimals(10600))
    }
  })

})
