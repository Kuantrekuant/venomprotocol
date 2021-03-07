import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { deployGovernanceToken } from './shared/deploy'

import Pit from '../build/Pit.json'

chai.use(solidity)

describe('Pit', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [alice, bob, carol] = provider.getWallets()

  let govToken: Contract
  let pit: Contract

  beforeEach(async () => {
    govToken = await deployGovernanceToken(alice)
    
    await govToken.mint(alice.address, "100")
    await govToken.mint(bob.address, "100")
    await govToken.mint(carol.address, "100")

    pit = await deployContract(alice, Pit, ["ViperPit", "xVIPER", govToken.address])
  })

  it('should have correct values for: name, symbol, decimals, totalSupply, balanceOf', async () => {
    const name = await pit.name()
    expect(name).to.eq('ViperPit')
    expect(await pit.symbol()).to.eq('xVIPER')
    expect(await pit.decimals()).to.eq(18)
    expect(await pit.totalSupply()).to.eq(0)
    expect(await pit.balanceOf(alice.address)).to.eq(0)
  })

  it("should not allow enter if not enough approve", async function () {
    await expect(pit.enter("100")).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
    await govToken.approve(pit.address, "50")
    await expect(pit.enter("100")).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
    await govToken.approve(pit.address, "100")
    await pit.enter("100")
    expect(await pit.balanceOf(alice.address)).to.equal("100")
  })

  it("should not allow withraw more than what you have", async function () {
    await govToken.approve(pit.address, "100")
    await pit.enter("100")
    await expect(pit.leave("200")).to.be.revertedWith("ERC20: burn amount exceeds balance")
  })

  it("should work with more than one participant", async function () {
    await govToken.approve(pit.address, "100")
    await govToken.connect(bob).approve(pit.address, "100")
    // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
    await pit.enter("20")
    await pit.connect(bob).enter("10")
    expect(await pit.balanceOf(alice.address)).to.equal("20")
    expect(await pit.balanceOf(bob.address)).to.equal("10")
    expect(await govToken.balanceOf(pit.address)).to.equal("30")
    // ViperPit get 20 more VIPERs from an external source.
    await govToken.connect(carol).transfer(pit.address, "20")
    // Alice deposits 10 more VIPERs. She should receive 10*30/50 = 6 shares.
    await pit.enter("10")
    expect(await pit.balanceOf(alice.address)).to.equal("26")
    expect(await pit.balanceOf(bob.address)).to.equal("10")
    // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
    await pit.connect(bob).leave("5")
    expect(await pit.balanceOf(alice.address)).to.equal("26")
    expect(await pit.balanceOf(bob.address)).to.equal("5")
    expect(await govToken.balanceOf(pit.address)).to.equal("52")
    expect(await govToken.balanceOf(alice.address)).to.equal("70")
    expect(await govToken.balanceOf(bob.address)).to.equal("98")
  })

})
