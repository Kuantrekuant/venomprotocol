import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterHerpetologist } from './shared'

import ViperToken from '../../build/ViperToken.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const LOCK_FROM_BLOCK = 1000
const LOCK_TO_BLOCK = 2000
const REWARDS_PER_BLOCK = expandTo18Decimals(1000)
const REWARDS_START_BLOCK = 0
const HALVING_AFTER_BLOCK_COUNT = 45360

describe('MasterHerpetologist::Authorization', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  let viperToken: Contract
  let chef: Contract
  
  beforeEach(async () => {
    viperToken = await deployContract(alice, ViperToken, [LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
    // 1000 VIPER per block, rewards start at block 0, rewards are halved after every 45360 blocks
    chef = await deployMasterHerpetologist(wallets, viperToken, REWARDS_PER_BLOCK, REWARDS_START_BLOCK, HALVING_AFTER_BLOCK_COUNT)
  })

  it("should allow the owner to reclaim ownership of the ViperToken", async function () {
    expect(await viperToken.transferOwnership(chef.address))

    expect(await viperToken.owner()).to.be.equal(chef.address)

    await expect(chef.reclaimTokenOwnership(alice.address))
      .to.emit(viperToken, 'OwnershipTransferred')
      .withArgs(chef.address, alice.address)
    
    expect(await viperToken.owner()).to.be.equal(alice.address)
  })

  it("should allow authorized users to reclaim ownership of the ViperToken", async function () {
    await chef.addAuthorized(bob.address)

    expect(await viperToken.transferOwnership(chef.address))

    expect(await viperToken.owner()).to.be.equal(chef.address)

    await expect(chef.connect(bob).reclaimTokenOwnership(bob.address))
      .to.emit(viperToken, 'OwnershipTransferred')
      .withArgs(chef.address, bob.address)
    
    expect(await viperToken.owner()).to.be.equal(bob.address)
  })

  it("unauthorized users shouldn't be able to reclaim ownership of the token back from MasterChef", async function () {
    expect(await viperToken.transferOwnership(chef.address))
    expect(await viperToken.owner()).to.be.equal(chef.address)

    await expect(chef.connect(bob).reclaimTokenOwnership(bob.address)).to.be.reverted
    
    expect(await viperToken.owner()).to.be.equal(chef.address)
  })

  it("should allow only authorized users to update the developer rewards address", async function () {
    expect(await chef.devaddr()).to.equal(dev.address)

    await expect(chef.connect(bob).dev(bob.address)).to.be.reverted

    await chef.addAuthorized(dev.address)
    await chef.connect(dev).dev(bob.address)
    expect(await chef.devaddr()).to.equal(bob.address)

    await chef.addAuthorized(bob.address)
    await chef.connect(bob).dev(alice.address)
    expect(await chef.devaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the liquidity provider rewards address", async function () {
    expect(await chef.liquidityaddr()).to.equal(liquidityFund.address)

    await expect(chef.connect(bob).lpUpdate(bob.address)).to.be.reverted

    await chef.addAuthorized(liquidityFund.address)
    await chef.connect(liquidityFund).lpUpdate(bob.address)
    expect(await chef.liquidityaddr()).to.equal(bob.address)

    await chef.addAuthorized(bob.address)
    await chef.connect(bob).lpUpdate(alice.address)
    expect(await chef.liquidityaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the community fund rewards address", async function () {
    expect(await chef.comfundaddr()).to.equal(communityFund.address)

    await expect(chef.connect(bob).comUpdate(bob.address)).to.be.reverted

    await chef.addAuthorized(communityFund.address)
    await chef.connect(communityFund).comUpdate(bob.address)
    expect(await chef.comfundaddr()).to.equal(bob.address)

    await chef.addAuthorized(bob.address)
    await chef.connect(bob).comUpdate(alice.address)
    expect(await chef.comfundaddr()).to.equal(alice.address)
  })

  it("should allow only authorized users to update the founder rewards address", async function () {
    expect(await chef.founderaddr()).to.equal(founderFund.address)

    await expect(chef.connect(bob).founderUpdate(bob.address)).to.be.reverted

    await chef.addAuthorized(founderFund.address)
    await chef.connect(founderFund).founderUpdate(bob.address)
    expect(await chef.founderaddr()).to.equal(bob.address)

    await chef.addAuthorized(bob.address)
    await chef.connect(bob).founderUpdate(alice.address)
    expect(await chef.founderaddr()).to.equal(alice.address)
  })
})
