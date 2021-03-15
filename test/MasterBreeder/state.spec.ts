import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { MaxUint256 } from 'ethers/constants'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { BigNumber, bigNumberify, BigNumberish } from 'ethers/utils'

import { expandTo18Decimals } from '../shared/utilities'

import { deployMasterBreeder } from '../shared/deploy'

import GovernanceToken from '../../build/GovernanceToken.json'

chai.use(solidity)

describe('MasterBreeder::State', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const wallets = provider.getWallets()
  const [alice, bob, carol, minter, dev, liquidityFund, communityFund, founderFund] = wallets

  const TOTAL_CAP = expandTo18Decimals(500000000) // 500m
  const MANUAL_MINT_LIMIT = expandTo18Decimals(50000) // 50k

  let govToken: Contract
  let breeder: Contract

  context("Ethereum", function () {
    // Original Bao values - used as control variables
    // Bao has modified FINISH_BONUS_AT_BLOCK since the inception of the contract - values will differ vs original contract instantiation
    const rewardsStartBlock = 11420726
    const halvingAfterBlockCount = 45360 // Ethereum blocks per week, based on ~13s block time

    const lockFromBlock = 13766564
    const lockToBlock = 20960714
    
    // This has been modified - contains two more multipliers (104 vs 102) compared to original Bao values.
    // Multipliers have also been significantly modified to suit VIPER:s emission model
    const rewardMultipliers = [256,128,64,32,32,16,16,8,8,8,8,8,8,8,8,8,8,8,8,8,8,4,4,4,4,4,4,2,2,2,2,2,1,1,1,1,1,1,2,2,2,2,2,4,4,4,8,8,8,8,8,16,16,16,16,16,16,16,16,16,16,8,8,8,8,8,8,4,4,2,2,1,1,1,1,1,1,2,2,4,4,4,4,8,8,8,8,8,16,16,32,32,32,32,16,8,4,2,1,1,1,1,2,2];
    const halvingAtBlocks: BigNumber[] = []

    beforeEach(async () => {
      govToken = await deployContract(alice, GovernanceToken, ["Viper", "VIPER", TOTAL_CAP, MANUAL_MINT_LIMIT, lockFromBlock, lockToBlock])
      breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(1000), rewardsStartBlock, halvingAfterBlockCount)
      await govToken.transferOwnership(breeder.address)
    })

    it("should set correct state variables", async function () {
      const usedGovToken = await breeder.govToken()
      const devaddr = await breeder.devaddr()
      const liquidityaddr = await breeder.liquidityaddr()
      const comfundaddr = await breeder.comfundaddr()
      const founderaddr = await breeder.founderaddr()
      const owner = await govToken.owner()

      expect(usedGovToken).to.equal(govToken.address)
      expect(devaddr).to.equal(dev.address)
      expect(liquidityaddr).to.equal(liquidityFund.address)
      expect(comfundaddr).to.equal(communityFund.address)
      expect(founderaddr).to.equal(founderFund.address)
      expect(owner).to.equal(breeder.address)
    })

    it("should calculate correct values for multipliers, rewards halvings and finish bonus block", async function () {
      this.timeout(0)
      let calculatedFinishBonusAtBlock: BigNumber
      const periods = 104

      expect(rewardMultipliers.length).to.equal(periods)

      for (let i = 0; i < rewardMultipliers.length - 1; i++) {
        expect(await breeder.REWARD_MULTIPLIER(i)).to.equal(rewardMultipliers[i])
        const halvingBlock = await breeder.HALVING_AT_BLOCK(i)
        halvingAtBlocks.push(halvingBlock)
      }

      calculatedFinishBonusAtBlock = new BigNumber(halvingAfterBlockCount).mul(rewardMultipliers.length - 1).add(rewardsStartBlock)
      
      // The final HALVING_AT_BLOCK member in the contract is uint256(-1) === MaxUint256
      // This is to ensure that getMultiplier will return 0 for the final HALVING_AT_BLOCK member
      halvingAtBlocks.push(MaxUint256)

      const checkCount = 10

      for (let i = 0; i < checkCount; i++) {
        const multiplier = i+1
        expect(halvingAtBlocks[i]).to.equal(rewardsStartBlock+halvingAfterBlockCount*multiplier+1)
      }

      // Second to last halving 
      expect(halvingAtBlocks[halvingAtBlocks.length-2]).to.equal(rewardsStartBlock+halvingAfterBlockCount*(periods-1)+1)

      const expectedFinishBonusAtBlock = 16092806
      expect(calculatedFinishBonusAtBlock).to.equal(expectedFinishBonusAtBlock)
      expect(await breeder.FINISH_BONUS_AT_BLOCK()).to.equal(expectedFinishBonusAtBlock)
    })

    it("should correctly calculate reward multipliers for all halving blocks", async function () {
      this.timeout(0)
      for (let i = 0; i < halvingAtBlocks.length; i++) {
        const halvingAtBlock = halvingAtBlocks[i]
        expect(await breeder.HALVING_AT_BLOCK(i)).to.equal(halvingAtBlock)

        const blockBefore = halvingAtBlock.sub(1)
        const multiplier = await breeder.getMultiplier(blockBefore, halvingAtBlock)
        expect(await breeder.REWARD_MULTIPLIER(i)).to.equal(multiplier)
        expect(rewardMultipliers[i]).to.equal(multiplier)
      }
    })

    it("should correctly update HALVING_AT_BLOCK using halvingUpdate", async function () {
      this.timeout(0)

      // Simulate BAO's update of HALVING_AT_BLOCK using halvingUpdate
      const updatedHalvingAtBlocks = [11511448,11556809,11602170,11647531,11692892,11738253,11783614,11828975,11874336,11919697,11965058,12010419,12055780,12101141,12146502,12191863,12237224,12282585,12327946,12373307,12418668,12464029,12509390,12554751,12600112,12645473,12690834,12736195,12781556,12826917,12872278,12917639,12963000,13008361,13053722,13099083,13144444,13189805,13235166,13280527,13325888,13371249,13416610,13461971,13507332,13552693,13598054,13643415,13688776,13734137,13779498,13824859,13870220,13915581,13960942,14006303,14051664,14097025,14142386,14187747,14233108,14278469,14323830,14369191,14414552,14459913,14505274,14550635,14595996,14641357,14686718,14732079,14777440,14822801,14868162,14913523,14958884,15004245,15049606,15094967,15140328,15185689,15231050,15276411,15321772,15367133,15412494,15457855,15503216,15548577,15593938,15639299,15684660,15730021,15775382,15820743,15866104,15911465,15956826,16002187,16047548,16092909,16138270,16183631]
      const updatedHalvingAfterBlockCount = 45361 // difference between an ensuing value and a previous value in the array above - original halving after block count was 45360

      await breeder.halvingUpdate(updatedHalvingAtBlocks)

      for (let i = 0; i < updatedHalvingAtBlocks.length; i++) {
        const halvingAtBlock = new BigNumber(updatedHalvingAtBlocks[i])
        expect(await breeder.HALVING_AT_BLOCK(i)).to.equal(halvingAtBlock)

        const blockBefore = halvingAtBlock.sub(1)
        const multiplier = await breeder.getMultiplier(blockBefore, halvingAtBlock)

        if (i < rewardMultipliers.length) {
          expect(await breeder.REWARD_MULTIPLIER(i)).to.equal(multiplier)
          expect(rewardMultipliers[i]).to.equal(multiplier)
        } else {
          expect(multiplier).to.equal(0)
        }
      }
    })
  })

  context("Harmony", function () {
    // Original Bao values - used as control variables
    // Bao has modified FINISH_BONUS_AT_BLOCK since the inception of the contract - values will differ vs original contract instantiation
    const rewardsStartBlock = 10183471
    const halvingAfterBlockCount = 302400 // Harmony blocks per week, based on ~2s block time

    const lockFromBlock = 22770895
    const lockToBlock = 38538895
    
    // This has been modified - contains two more multipliers (104 vs 102) compared to original Bao values.
    // Multipliers have also been significantly modified to suit VIPER:s emission model
    const rewardMultipliers = [256,128,64,32,32,16,16,8,8,8,8,8,8,8,8,8,8,8,8,8,8,4,4,4,4,4,4,2,2,2,2,2,1,1,1,1,1,1,2,2,2,2,2,4,4,4,8,8,8,8,8,16,16,16,16,16,16,16,16,16,16,8,8,8,8,8,8,4,4,2,2,1,1,1,1,1,1,2,2,4,4,4,4,8,8,8,8,8,16,16,32,32,32,32,16,8,4,2,1,1,1,1,2,2]
    const halvingAtBlocks: BigNumber[] = []

    beforeEach(async () => {
      govToken = await deployContract(alice, GovernanceToken, ["Viper", "VIPER", TOTAL_CAP, MANUAL_MINT_LIMIT, lockFromBlock, lockToBlock])
      breeder = await deployMasterBreeder(wallets, govToken, expandTo18Decimals(1000), rewardsStartBlock, halvingAfterBlockCount)
      await govToken.transferOwnership(breeder.address)
    })

    it("should set correct state variables", async function () {
      const usedGovToken = await breeder.govToken()
      const devaddr = await breeder.devaddr()
      const liquidityaddr = await breeder.liquidityaddr()
      const comfundaddr = await breeder.comfundaddr()
      const founderaddr = await breeder.founderaddr()
      const owner = await govToken.owner()

      expect(usedGovToken).to.equal(govToken.address)
      expect(devaddr).to.equal(dev.address)
      expect(liquidityaddr).to.equal(liquidityFund.address)
      expect(comfundaddr).to.equal(communityFund.address)
      expect(founderaddr).to.equal(founderFund.address)
      expect(owner).to.equal(breeder.address)
    })

    it("should calculate correct values for multipliers, rewards halvings and finish bonus block", async function () {
      this.timeout(0)
      let calculatedFinishBonusAtBlock: BigNumber
      const periods = 104

      expect(rewardMultipliers.length).to.equal(periods)

      for (let i = 0; i < rewardMultipliers.length - 1; i++) {
        const rewardMultiplier = await breeder.REWARD_MULTIPLIER(i)
        const halvingBlock = await breeder.HALVING_AT_BLOCK(i)
        halvingAtBlocks.push(halvingBlock)

        expect(rewardMultiplier).to.equal(rewardMultipliers[i])
        //console.log(`Week: ${i+1}, halvingBlock: ${halvingBlock}, rewardMultiplier: ${rewardMultiplier}`) 
      }

      calculatedFinishBonusAtBlock = new BigNumber(halvingAfterBlockCount).mul(rewardMultipliers.length - 1).add(rewardsStartBlock)
      
      // The final HALVING_AT_BLOCK member in the contract is uint256(-1) === MaxUint256
      // This is to ensure that getMultiplier will return 0 for the final HALVING_AT_BLOCK member
      halvingAtBlocks.push(MaxUint256)

      const checkCount = 10

      for (let i = 0; i < checkCount; i++) {
        const multiplier = i+1
        expect(halvingAtBlocks[i]).to.equal(rewardsStartBlock+halvingAfterBlockCount*multiplier+1)
      }

      // Second to last halving 
      expect(halvingAtBlocks[halvingAtBlocks.length-2]).to.equal(rewardsStartBlock+halvingAfterBlockCount*(periods-1)+1)

      const expectedFinishBonusAtBlock = 41330671
      expect(calculatedFinishBonusAtBlock).to.equal(expectedFinishBonusAtBlock)
      expect(await breeder.FINISH_BONUS_AT_BLOCK()).to.equal(expectedFinishBonusAtBlock)
    })

    it("should correctly calculate reward multipliers for all halving blocks", async function () {
      this.timeout(0)
      for (let i = 0; i < halvingAtBlocks.length; i++) {
        const halvingAtBlock = halvingAtBlocks[i]
        expect(await breeder.HALVING_AT_BLOCK(i)).to.equal(halvingAtBlock)

        const blockBefore = halvingAtBlock.sub(1)
        const multiplier = await breeder.getMultiplier(blockBefore, halvingAtBlock)
        expect(await breeder.REWARD_MULTIPLIER(i)).to.equal(multiplier)
        expect(rewardMultipliers[i]).to.equal(multiplier)
      }
    })
  })

})
