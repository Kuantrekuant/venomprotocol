import chai, { expect } from 'chai'
import { utils, Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, humanBalance } from '../shared/utilities'
import { advanceBlockTo } from '../shared/time'

import { deployMasterBreeder, deployGovernanceToken } from '../shared/deploy'

import ERC20Mock from '../../build/ERC20Mock.json'

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const debugMessages = false
const mintAmount = expandTo18Decimals(1000)
const depositAmount = expandTo18Decimals(100)

chai.use(solidity)

describe('MasterBreeder::Fees', () => {
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
    await lp.transfer(alice.address, mintAmount)
    await lp.transfer(bob.address, mintAmount)
    await lp.transfer(carol.address, mintAmount)

    lp2 = await deployContract(minter, ERC20Mock, ["LPToken2", "LP2", expandTo18Decimals(1000000)])
    await lp2.transfer(alice.address, mintAmount)
    await lp2.transfer(bob.address, mintAmount)
    await lp2.transfer(carol.address, mintAmount)
  })

  it("should be able to set deposit fees to zero", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)
    await govToken.transferOwnership(breeder.address)

    expect(await breeder.userDepFee()).to.equal(75)
    expect(await breeder.devDepFee()).to.equal(9925)

    await breeder.setUserDepFee(0)
    await breeder.setDevDepFee(10000)

    expect(await breeder.userDepFee()).to.equal(0)
    expect(await breeder.devDepFee()).to.equal(10000)
  })

  it("should charge a deposit fee when deposit fees are set to default values", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)
    await govToken.transferOwnership(breeder.address)

    expect(await breeder.userDepFee()).to.equal(75)
    expect(await breeder.devDepFee()).to.equal(9925)

    await breeder.add(rewardsPerBlock, lp.address, true)

    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)

    const poolId = 0
    const depositAmount = expandTo18Decimals(100)

    await lp.connect(bob).approve(breeder.address, expandTo18Decimals(1000))
    await breeder.connect(bob).deposit(poolId, depositAmount, ZERO_ADDRESS)

    const userInfo = await breeder.userInfo(poolId, bob.address)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by ${bob.address} is: ${utils.formatEther(userInfo.amount)}`)
    expect(userInfo.amount).to.lt(depositAmount)

    const devAddress = await breeder.devaddr()
    if (debugMessages) console.log(`Dev address is: ${devAddress}`)
    expect(devAddress.length).to.be.greaterThan(0)

    const devUserInfo = await breeder.userInfo(poolId, devAddress)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by dev address ${devAddress} is: ${utils.formatEther(devUserInfo.amount)}`)
    expect(devUserInfo.amount).to.gt(0)
  })

  it("shouldn't charge a deposit fee when deposit fees have been set to zero", async function () {
    // 1 VIPER per block farming rate starting at block 100 with the first halvening block starting 1000 blocks after the start block
    const rewardsPerBlock = 1
    const rewardsStartAtBlock = 100
    const breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)
    await govToken.transferOwnership(breeder.address)

    expect(await breeder.userDepFee()).to.equal(75)
    expect(await breeder.devDepFee()).to.equal(9925)

    await breeder.setUserDepFee(0)
    await breeder.setDevDepFee(10000)

    expect(await breeder.userDepFee()).to.equal(0)
    expect(await breeder.devDepFee()).to.equal(10000)

    await breeder.add(rewardsPerBlock, lp.address, true)

    expect(await breeder.poolLength()).to.equal(1)
    expect(await breeder.poolExistence(lp.address)).to.equal(true)
    const poolId = 0

    await lp.connect(bob).approve(breeder.address, mintAmount)
    
    await breeder.connect(bob).deposit(poolId, depositAmount, ZERO_ADDRESS)

    const devAddress = await breeder.devaddr()
    if (debugMessages) console.log(`Dev address is: ${devAddress}`)
    expect(devAddress.length).to.be.greaterThan(0)

    let userInfo = await breeder.userInfo(poolId, bob.address)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by ${bob.address} is: ${utils.formatEther(userInfo.amount)}`)
    expect(userInfo.amount).to.eq(depositAmount)

    let devUserInfo = await breeder.userInfo(poolId, devAddress)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by dev address ${devAddress} is: ${utils.formatEther(devUserInfo.amount)}`)
    expect(devUserInfo.amount).to.equal('0')

    await breeder.connect(bob).deposit(poolId, depositAmount, ZERO_ADDRESS)

    userInfo = await breeder.userInfo(poolId, bob.address)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by ${bob.address} is: ${utils.formatEther(userInfo.amount)}`)
    expect(userInfo.amount).to.eq(depositAmount.mul(2))

    devUserInfo = await breeder.userInfo(poolId, devAddress)
    if (debugMessages) console.log(`Staked amount of lp token ${lp.address} in pool ${poolId} by dev address ${devAddress} is: ${utils.formatEther(devUserInfo.amount)}`)
    expect(devUserInfo.amount).to.equal('0')

    // Make sure claiming rewards & exiting the pool works as expected
    await advanceBlockTo(provider, rewardsStartAtBlock+10)
    await breeder.connect(bob).claimReward(poolId)

    if (debugMessages) humanBalance(provider, govToken, 'balanceOf', bob.address, 'bob.address')
    const bobBalanceOf = await govToken.balanceOf(bob.address)
    expect(bobBalanceOf).to.gt('0')

    if (debugMessages) humanBalance(provider, govToken, 'lockOf', bob.address, 'bob.address')
    const bobLockOf = await govToken.lockOf(bob.address)
    expect(bobLockOf).to.gt('0')

    if (debugMessages) humanBalance(provider, govToken, 'totalBalanceOf', bob.address, 'bob.address')
    const bobTotalBalanceOf = await govToken.totalBalanceOf(bob.address)
    expect(bobTotalBalanceOf).to.gt('0')

    await advanceBlockTo(provider, rewardsStartAtBlock*2)
    await breeder.connect(bob).withdraw(poolId, depositAmount.mul(2), ZERO_ADDRESS)

    // Withdrawal fees are still active - user will end up with a lesser balance of LP tokens
    const lpBalance = await lp.balanceOf(bob.address)
    if (debugMessages) console.log(`Current lp token ${lp.address} balance for ${bob.address} is: ${utils.formatEther(lpBalance)}`)
    expect(lpBalance).to.eq(mintAmount.sub(expandTo18Decimals(16)))
  })

})
