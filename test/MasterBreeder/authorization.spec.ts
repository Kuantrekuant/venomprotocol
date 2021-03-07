import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterBreeder, deployGovernanceToken } from '../shared/deploy'

chai.use(solidity)

const REWARDS_PER_BLOCK = expandTo18Decimals(1000)
const REWARDS_START_BLOCK = 0
const HALVING_AFTER_BLOCK_COUNT = 45360

describe('MasterBreeder::Authorization', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let govToken: Contract
  let breeder: Contract
  
  beforeEach(async () => {
    govToken = await deployGovernanceToken(alice)
    // 1000 VIPER per block, rewards start at block 0, rewards are halved after every 45360 blocks
    breeder = await deployMasterBreeder(wallets, govToken, REWARDS_PER_BLOCK, REWARDS_START_BLOCK, HALVING_AFTER_BLOCK_COUNT)
  })

  it("should allow the owner to reclaim ownership of the Viper token", async function () {
    expect(await govToken.transferOwnership(breeder.address))

    expect(await govToken.owner()).to.be.equal(breeder.address)

    await expect(breeder.reclaimTokenOwnership(alice.address))
      .to.emit(govToken, 'OwnershipTransferred')
      .withArgs(breeder.address, alice.address)
    
    expect(await govToken.owner()).to.be.equal(alice.address)
  })

  it("should allow authorized users to reclaim ownership of the Viper token", async function () {
    await breeder.addAuthorized(bob.address)

    expect(await govToken.transferOwnership(breeder.address))

    expect(await govToken.owner()).to.be.equal(breeder.address)

    await expect(breeder.connect(bob).reclaimTokenOwnership(bob.address))
      .to.emit(govToken, 'OwnershipTransferred')
      .withArgs(breeder.address, bob.address)
    
    expect(await govToken.owner()).to.be.equal(bob.address)
  })

  it("unauthorized users shouldn't be able to reclaim ownership of the token back from MasterChef", async function () {
    expect(await govToken.transferOwnership(breeder.address))
    expect(await govToken.owner()).to.be.equal(breeder.address)

    await expect(breeder.connect(bob).reclaimTokenOwnership(bob.address)).to.be.reverted
    
    expect(await govToken.owner()).to.be.equal(breeder.address)
  })

  it("should allow only authorized users to update the developer rewards address", async function () {
    expect(await breeder.devaddr()).to.equal(dev.address)

    await expect(breeder.connect(bob).dev(bob.address)).to.be.reverted

    await breeder.addAuthorized(dev.address)
    await breeder.connect(dev).dev(bob.address)
    expect(await breeder.devaddr()).to.equal(bob.address)

    await breeder.addAuthorized(bob.address)
    await breeder.connect(bob).dev(alice.address)
    expect(await breeder.devaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the liquidity provider rewards address", async function () {
    expect(await breeder.liquidityaddr()).to.equal(liquidityFund.address)

    await expect(breeder.connect(bob).lpUpdate(bob.address)).to.be.reverted

    await breeder.addAuthorized(liquidityFund.address)
    await breeder.connect(liquidityFund).lpUpdate(bob.address)
    expect(await breeder.liquidityaddr()).to.equal(bob.address)

    await breeder.addAuthorized(bob.address)
    await breeder.connect(bob).lpUpdate(alice.address)
    expect(await breeder.liquidityaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the community fund rewards address", async function () {
    expect(await breeder.comfundaddr()).to.equal(communityFund.address)

    await expect(breeder.connect(bob).comUpdate(bob.address)).to.be.reverted

    await breeder.addAuthorized(communityFund.address)
    await breeder.connect(communityFund).comUpdate(bob.address)
    expect(await breeder.comfundaddr()).to.equal(bob.address)

    await breeder.addAuthorized(bob.address)
    await breeder.connect(bob).comUpdate(alice.address)
    expect(await breeder.comfundaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the founder rewards address", async function () {
    expect(await breeder.founderaddr()).to.equal(founderFund.address)

    await expect(breeder.connect(bob).founderUpdate(bob.address)).to.be.reverted

    await breeder.addAuthorized(founderFund.address)
    await breeder.connect(founderFund).founderUpdate(bob.address)
    expect(await breeder.founderaddr()).to.equal(bob.address)

    await breeder.addAuthorized(bob.address)
    await breeder.connect(bob).founderUpdate(alice.address)
    expect(await breeder.founderaddr()).to.equal(alice.address)
  })
})
