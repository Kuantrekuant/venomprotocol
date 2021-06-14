import chai, { expect } from 'chai'
import { utils, Contract } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from '../shared/utilities'
import { advanceBlockTo, latestBlock } from '../shared/time'

import GovernanceToken from '../../build/GovernanceToken.json'

chai.use(solidity)

const TOTAL_CIRCULATING_SUPPLY = expandTo18Decimals(1000000)
const REGULAR_MINT_AMOUNT = expandTo18Decimals(20000)
const NO_MANUAL_MINTED = 0
const MANUAL_MINT_AMOUNT = expandTo18Decimals(999)
const TEST_AMOUNT = expandTo18Decimals(10)

const TOTAL_CAP = expandTo18Decimals(500000000)
const MANUAL_MINT_LIMIT = expandTo18Decimals(50000)
const LOCK_FROM_BLOCK = 100
const LOCK_TO_BLOCK = 200

describe('GovernanceToken::Minting', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [alice, bob] = provider.getWallets()

  let token: Contract
  beforeEach(async () => {
    token = await deployContract(alice, GovernanceToken, ["Viper", "VIPER", TOTAL_CAP, MANUAL_MINT_LIMIT, LOCK_FROM_BLOCK, LOCK_TO_BLOCK])
    await token.mint(alice.address, TOTAL_CIRCULATING_SUPPLY)
  })

  it('should have correct values for: manualMintLimit, manualMinted', async () => {
    expect(await token.manualMintLimit()).to.eq(MANUAL_MINT_LIMIT)
    expect(await token.manualMinted()).to.eq(NO_MANUAL_MINTED)
  })

  it('the owner or an authorized user should be able to mint', async () => {
    await expect(token.mint(alice.address, REGULAR_MINT_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs('0x0000000000000000000000000000000000000000', alice.address, REGULAR_MINT_AMOUNT)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.add(REGULAR_MINT_AMOUNT))
  })

  it('an unauthorized user should not be able to mint', async () => {
    await expect(token.connect(bob).mint(bob.address, MANUAL_MINT_AMOUNT)).to.be.reverted
  })

  it('should be able to perform a standard manualMint', async () => {
    await expect(token.manualMint(alice.address, MANUAL_MINT_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs('0x0000000000000000000000000000000000000000', alice.address, MANUAL_MINT_AMOUNT)
    expect(await token.manualMinted()).to.eq(MANUAL_MINT_AMOUNT)
    expect(await token.balanceOf(alice.address)).to.eq(TOTAL_CIRCULATING_SUPPLY.add(MANUAL_MINT_AMOUNT))
  })

  it('should be able to manually mint the exact manualMintLimit', async () => {
    await expect(token.manualMint(alice.address, MANUAL_MINT_LIMIT))
      .not.to.be.reverted
    expect(await token.manualMinted()).to.eq(MANUAL_MINT_LIMIT)
  })

  it('should fail if you try to manualMint above manualMintLimit', async () => {
    await expect(token.manualMint(alice.address, MANUAL_MINT_LIMIT.add(expandTo18Decimals(1))))
      .to.be.revertedWith("ERC20: sum of manualMinted and amount greater than manualMintLimit")
    expect(await token.manualMinted()).to.eq(NO_MANUAL_MINTED)
  })

  it('should fail if you try to manualMint using a non-authorized address', async () => {
    //await token.removeAuthorized(alice.address)
    await token.renounceOwnership()
    await expect(token.manualMint(alice.address, MANUAL_MINT_AMOUNT)).to.be.reverted
    expect(await token.manualMinted()).to.eq(NO_MANUAL_MINTED)

    await expect(token.connect(bob).manualMint(alice.address, MANUAL_MINT_AMOUNT)).to.be.reverted
    expect(await token.manualMinted()).to.eq(NO_MANUAL_MINTED)
  })

  it('should fail if you try to mint an amount greater than the hard cap', async () => {
    await expect(token.mint(alice.address, TOTAL_CAP))
      .to.be.revertedWith("ERC20Capped: cap exceeded")
    expect(await token.totalSupply()).to.eq(TOTAL_CIRCULATING_SUPPLY)
  })

})
