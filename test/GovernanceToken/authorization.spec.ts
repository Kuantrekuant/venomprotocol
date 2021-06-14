import chai, { expect } from 'chai'
import { Contract } from 'ethers'
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

describe('GovernanceToken::Authorization', () => {
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

  it('should be able to addAuthorized for own address', async () => {
    await token.addAuthorized(alice.address)
    expect(await token.authorized(alice.address)).to.eq(true)
  })

  it('should be able to addAuthorized for an address', async () => {
    await token.addAuthorized(bob.address)
    expect(await token.authorized(bob.address)).to.eq(true)
  })

  it('should fail to remove authorization for the same address requesting removeAuthorized', async () => {
    await token.addAuthorized(alice.address)
    expect(await token.authorized(alice.address)).to.eq(true)
    await expect(token.removeAuthorized(alice.address)).to.be.reverted
  })

  it('should succeed to remove authorization for an address', async () => {
    await token.addAuthorized(bob.address)
    expect(await token.authorized(bob.address)).to.eq(true)
    await token.removeAuthorized(bob.address)
    expect(await token.authorized(bob.address)).to.eq(false)
  })
})
