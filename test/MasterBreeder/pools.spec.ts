import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterBreeder, deployGovernanceToken } from '../shared/deploy'

import ERC20Mock from '../../build/ERC20Mock.json'

chai.use(solidity)

describe('MasterBreeder::Pools', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let govToken: Contract
  let lp: Contract
  let lp2: Contract
  
  beforeEach(async () => {
    govToken = await deployGovernanceToken(alice)

    lp = await deployContract(minter, ERC20Mock, ["LPToken", "LP", expandTo18Decimals(1000000)])
    await lp.transfer(alice.address, expandTo18Decimals(1000))
    await lp.transfer(bob.address, expandTo18Decimals(1000))
    await lp.transfer(carol.address, expandTo18Decimals(1000))

    lp2 = await deployContract(minter, ERC20Mock, ["LPToken2", "LP2", expandTo18Decimals(1000000)])
    await lp2.transfer(alice.address, expandTo18Decimals(1000))
    await lp2.transfer(bob.address, expandTo18Decimals(1000))
    await lp2.transfer(carol.address, expandTo18Decimals(1000))
  })

  it("should be able to add a pool", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await breeder.add(rewardsPerBlock, lp.address, true)

    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)
  })

  it("should not be able to add the same pool twice", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await breeder.add(rewardsPerBlock, lp.address, true)

    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)

    await expect(breeder.add(rewardsPerBlock, lp.address, true)).to.be.revertedWith("MasterBreeder::nonDuplicated: duplicated")
  })

  it("should not be able to add a pool as an unauthorized user", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await expect(breeder.connect(bob).add(rewardsPerBlock, lp.address, true)).to.be.revertedWith("Ownable: caller is not the owner")
    expect(await breeder.poolLength()).to.equal(0)
    expect(await breeder.poolExistence(lp.address)).to.equal(false)
  })

  it("should be able to add multiple pools", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await breeder.add(rewardsPerBlock, lp.address, true)
    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)

    await breeder.add(rewardsPerBlock, lp2.address, true)
    expect(await breeder.poolLength()).to.equal(2)
    expect(await breeder.poolExistence(lp2.address)).to.equal(true)
  })

  it("should be able to change the allocation points for a given pool", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await breeder.add(rewardsPerBlock, lp.address, true)
    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)

    await breeder.set(0, rewardsPerBlock * 10, true)
    const [_lpToken, allocPoint, _lastRewardBlock, _accViperPerShare] = await breeder.poolInfo(0)
    expect(allocPoint).to.equal(rewardsPerBlock * 10)
  })

  it("should not be able to change the allocation points for a given pool as an unauthorized user", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)

    await govToken.transferOwnership(breeder.address)

    await breeder.add(rewardsPerBlock, lp.address, true)
    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)

    await expect(breeder.connect(bob).set(0, rewardsPerBlock * 10, true)).to.be.revertedWith("Ownable: caller is not the owner")
  })
})
