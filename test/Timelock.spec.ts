import chai, { expect } from 'chai'
import { Contract, utils } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { deployMasterBreeder, deployGovernanceToken } from './shared/deploy'
import { expandTo18Decimals, encodeParameters } from './shared/utilities'
import { latest, duration, increase } from './shared/time'

import Timelock from '../build/Timelock.json'
import ERC20Mock from '../build/ERC20Mock.json'

const rewardsPerBlock = 1
const rewardsStartAtBlock = 100

describe("Timelock", () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let govToken: Contract
  let chef: Contract
  let timelock: Contract

  beforeEach(async () => {
    govToken = await deployGovernanceToken(alice)
    chef = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(rewardsPerBlock), rewardsStartAtBlock, 1000)
    timelock = await deployContract(alice, Timelock, [bob.address, "172800"]) // 2 day / 48 hour timelock
  })

  it("should not allow non-owner to do operation", async function () {
    await govToken.transferOwnership(timelock.address)
    await expect(govToken.transferOwnership(carol.address)).to.be.revertedWith("Ownable: caller is not the owner")
    await expect(govToken.connect(bob).transferOwnership(carol.address)).to.be.revertedWith("Ownable: caller is not the owner")

    await expect(
      timelock.queueTransaction(
        govToken.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol.address]),
        (await latest(provider)).add(duration.days(3))
      )
    ).to.be.revertedWith("Timelock::queueTransaction: Call must come from admin.")
  })

  it("should do the timelock thing", async function () {
    await govToken.transferOwnership(timelock.address)
    const eta = (await latest(provider)).add(duration.days(3))
    await timelock
      .connect(bob)
      .queueTransaction(govToken.address, "0", "transferOwnership(address)", encodeParameters(["address"], [carol.address]), eta)
    await increase(provider, duration.days(1).toNumber())
    await expect(
      timelock
        .connect(bob)
        .executeTransaction(govToken.address, "0", "transferOwnership(address)", encodeParameters(["address"], [carol.address]), eta)
    ).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't surpassed time lock.")
    await increase(provider, duration.days(3).toNumber())
    await timelock
      .connect(bob)
      .executeTransaction(govToken.address, "0", "transferOwnership(address)", encodeParameters(["address"], [carol.address]), eta)
    expect(await govToken.owner()).to.equal(carol.address)
  })

  it("should also work with MasterChef", async function () {
    const lp1 = await deployContract(minter, ERC20Mock, ["LPToken", "LP", "10000000000"])
    const lp2 = await deployContract(minter, ERC20Mock, ["LPToken", "LP", "10000000000"])
    await govToken.transferOwnership(chef.address)
    await chef.add("100", lp1.address, true)
    await chef.transferOwnership(timelock.address)
    const eta = (await latest(provider)).add(duration.days(3))
    await timelock
      .connect(bob)
      .queueTransaction(
        chef.address,
        "0",
        "set(uint256,uint256,bool)",
        encodeParameters(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )
    await timelock
      .connect(bob)
      .queueTransaction(
        chef.address,
        "0",
        "add(uint256,address,bool)",
        encodeParameters(["uint256", "address", "bool"], ["100", lp2.address, false]),
        eta
      )
    await increase(provider, duration.days(3).toNumber())
    await timelock
      .connect(bob)
      .executeTransaction(
        chef.address,
        "0",
        "set(uint256,uint256,bool)",
        encodeParameters(["uint256", "uint256", "bool"], ["0", "200", false]),
        eta
      )
    await timelock
      .connect(bob)
      .executeTransaction(
        chef.address,
        "0",
        "add(uint256,address,bool)",
        encodeParameters(["uint256", "address", "bool"], ["100", lp2.address, false]),
        eta
      )
    expect((await chef.poolInfo("0")).allocPoint).to.equal("200")
    expect(await chef.totalAllocPoint()).to.equal("300")
    expect(await chef.poolLength()).to.equal("2")
  })
})
