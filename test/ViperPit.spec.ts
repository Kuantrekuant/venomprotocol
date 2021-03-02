import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, advanceBlockTo, latestBlock } from './shared/utilities'

import Viper from '../build/Viper.json'
import ViperPit from '../build/ViperPit.json'

chai.use(solidity)

const LOCK_FROM_BLOCK = 100
const LOCK_TO_BLOCK = 200

describe('ViperPit', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [alice, bob, carol] = provider.getWallets()

  let viperToken: Contract
  let viperPit: Contract

  beforeEach(async () => {
    viperToken = await deployContract(alice, Viper, [LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
    
    await viperToken.mint(alice.address, "100")
    await viperToken.mint(bob.address, "100")
    await viperToken.mint(carol.address, "100")

    viperPit = await deployContract(alice, ViperPit, [viperToken.address])
  })

  it('should have correct values for: name, symbol, decimals, totalSupply, balanceOf', async () => {
    const name = await viperPit.name()
    expect(name).to.eq('ViperPit')
    expect(await viperPit.symbol()).to.eq('xVIPER')
    expect(await viperPit.decimals()).to.eq(18)
    expect(await viperPit.totalSupply()).to.eq(0)
    expect(await viperPit.balanceOf(alice.address)).to.eq(0)
  })

  it("should not allow enter if not enough approve", async function () {
    await expect(viperPit.enter("100")).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
    await viperToken.approve(viperPit.address, "50")
    await expect(viperPit.enter("100")).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
    await viperToken.approve(viperPit.address, "100")
    await viperPit.enter("100")
    expect(await viperPit.balanceOf(alice.address)).to.equal("100")
  })

  it("should not allow withraw more than what you have", async function () {
    await viperToken.approve(viperPit.address, "100")
    await viperPit.enter("100")
    await expect(viperPit.leave("200")).to.be.revertedWith("ERC20: burn amount exceeds balance")
  })

  it("should work with more than one participant", async function () {
    await viperToken.approve(viperPit.address, "100")
    await viperToken.connect(bob).approve(viperPit.address, "100")
    // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
    await viperPit.enter("20")
    await viperPit.connect(bob).enter("10")
    expect(await viperPit.balanceOf(alice.address)).to.equal("20")
    expect(await viperPit.balanceOf(bob.address)).to.equal("10")
    expect(await viperToken.balanceOf(viperPit.address)).to.equal("30")
    // ViperPit get 20 more VIPERs from an external source.
    await viperToken.connect(carol).transfer(viperPit.address, "20")
    // Alice deposits 10 more VIPERs. She should receive 10*30/50 = 6 shares.
    await viperPit.enter("10")
    expect(await viperPit.balanceOf(alice.address)).to.equal("26")
    expect(await viperPit.balanceOf(bob.address)).to.equal("10")
    // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
    await viperPit.connect(bob).leave("5")
    expect(await viperPit.balanceOf(alice.address)).to.equal("26")
    expect(await viperPit.balanceOf(bob.address)).to.equal("5")
    expect(await viperToken.balanceOf(viperPit.address)).to.equal("52")
    expect(await viperToken.balanceOf(alice.address)).to.equal("70")
    expect(await viperToken.balanceOf(bob.address)).to.equal("98")
  })

})
