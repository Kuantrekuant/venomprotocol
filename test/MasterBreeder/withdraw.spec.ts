import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterBreeder, deployGovernanceToken, TOKEN_NAME, TOKEN_SYMBOL, TOTAL_CAP, MANUAL_MINT_LIMIT } from '../shared/deploy'

import ERC20Mock from '../../build/ERC20Mock.json'

chai.use(solidity)

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

// Viper token locks
const LOCK_FROM_BLOCK = 250
const LOCK_TO_BLOCK = 500

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

    it("should allow emergency withdraw", async function () {
      this.timeout(0)
      // 1 per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
      const rewardsPerBlock = 1
      const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), 100, 1000)

      await breeder.add(rewardsPerBlock, lp.address, true)

      await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))

      await breeder.connect(bob).deposit(0, expandTo18Decimals(100), ZERO_ADDRESS)

      expect(await lp.balanceOf(bob.address)).to.equal(expandTo18Decimals(900))

      // Even for emergency withdraws there are still withdrawal penalties applied
      // Bob will end up with 975 tokens
      // Dev address should now hold 25 tokens
      await breeder.connect(bob).emergencyWithdraw(0)

      expect(await lp.balanceOf(bob.address)).to.equal('974437500000000000000')
      expect(await lp.balanceOf(dev.address)).to.equal('24812500000000000000')
    })
  })
})
