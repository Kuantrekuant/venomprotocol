// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@venomswap/core/contracts/interfaces/IUniswapV2Pair.sol";
import "./interfaces/IGovernanceToken.sol";
import "./interfaces/IMasterBreeder.sol";

contract GovernanceVote {
  using SafeMath for uint256;

  string private _name;
  string private _symbol;
  uint8 private _decimals;
  uint8 private _poolId;
  uint8 private _lpMultiplier;
  uint8 private _singleStakingMultiplier;
  uint8 private _govTokenReservePosition;

  IGovernanceToken public govToken;
  IMasterBreeder public masterBreeder;
  IUniswapV2Pair public lpPair;
  IERC20 public pit;

  constructor(
    string memory name_,
    string memory symbol_,
    IGovernanceToken govToken_,
    IERC20 pit_,
    IMasterBreeder masterBreeder_,
    uint8 poolId_,
    IUniswapV2Pair lpPair_,
    uint8 govTokenReservePosition_,
    uint8 lpMultiplier_,
    uint8 singleStakingMultiplier_
  ) public {
    _name = name_;
    _symbol = symbol_;
    _decimals = 18;
    govToken = govToken_;
    pit = pit_;
    masterBreeder = masterBreeder_;
    _poolId = poolId_;
    lpPair = lpPair_;
    _govTokenReservePosition = govTokenReservePosition_;
    _lpMultiplier = lpMultiplier_;
    _singleStakingMultiplier = singleStakingMultiplier_;
  }

  function name() public view virtual returns (string memory) {
      return _name;
  }

  function symbol() public view virtual returns (string memory) {
      return _symbol;
  }

  function decimals() public view virtual returns (uint8) {
      return _decimals;
  }

  function allowance(address, address) public pure returns (uint256) { return 0; }
  function transfer(address, uint256) public pure returns (bool) { return false; }
  function approve(address, uint256) public pure returns (bool) { return false; }
  function transferFrom(address, address, uint256) public pure returns (bool) { return false; }

  function govTokenReserve() public view returns (uint256) {
    (uint256 reserve0, uint256 reserve1,) = lpPair.getReserves();
    uint256 _govTokenReserve = 0;

    if (_govTokenReservePosition == 0) {
      _govTokenReserve = reserve0;
    } else if (_govTokenReservePosition == 1) {
      _govTokenReserve = reserve1;
    }

    return _govTokenReserve;
  }

  function pitRatio() public view returns (uint256) {
    uint256 pitTotalSupply = pit.totalSupply();
    uint256 govTokenPitBalance = govToken.balanceOf(address(pit));
    if (pitTotalSupply > 0 && govTokenPitBalance > 0) {
      return govTokenPitBalance.mul(10 ** 18).div(pitTotalSupply);
    }
    return uint256(1).mul(10 ** 18);
  }

  function adjustedPitValue(uint256 value) public view returns (uint256) {
    return value.mul(pitRatio()).div(10 ** 18);
  }

  function totalSupply() public view returns (uint256) {
    uint256 govTokenCurrentReserve = govTokenReserve();
    uint256 pitTotalSupply = pit.totalSupply();
    uint256 unlockedTotal = govToken.unlockedSupply();
    uint256 lockedTotal = govToken.totalLock();

    uint256 calculatedTotalSupply = 0;

    // govTokenCurrentReserve x _lpMultiplier (e.g. 4) tokens are added to the total supply
    if (govTokenCurrentReserve > 0) {
      calculatedTotalSupply = govTokenCurrentReserve.mul(_lpMultiplier);
    }

    // pitTotalSupply x _singleStakingMultiplier (e.g. 2) tokens are added to the total supply
    if (pitTotalSupply > 0) {
      calculatedTotalSupply = calculatedTotalSupply.add(
        adjustedPitValue(pitTotalSupply).mul(_singleStakingMultiplier)
      );
    }

    // 33% of locked tokens are added to the total supply
    if (lockedTotal > 0) {
      calculatedTotalSupply = calculatedTotalSupply.add(lockedTotal.mul(33).div(100));
    }

    // 25% of unlocked tokens are added to the total supply
    if (unlockedTotal > 0) {
      calculatedTotalSupply = calculatedTotalSupply.add(unlockedTotal.mul(25).div(100));
    }

    return calculatedTotalSupply;
  }

  function balanceOf(address owner) public view returns (uint256) {    
    uint256 votingPower = 0;

    uint256 govTokenCurrentReserve = govTokenReserve();

    (uint256 userLpTokenAmountInPool, ) = masterBreeder.userInfo(_poolId, owner);
    uint256 pairTotal = lpPair.totalSupply();
    
    // Calculate lp share voting power
    uint256 userShare = userLpTokenAmountInPool.mul(1e12).div(pairTotal);
    uint256 pairUnderlying = govTokenCurrentReserve.mul(userShare).div(1e12);
    votingPower = pairUnderlying.mul(_lpMultiplier);

    // Add single-staking voting power
    uint256 pitBalance = pit.balanceOf(owner);
    if (pitBalance > 0) {
      votingPower = votingPower.add(
        adjustedPitValue(pitBalance).mul(_singleStakingMultiplier)
      );
    }
    
    // Add locked balance
    uint256 lockedBalance = govToken.lockOf(owner);
    if (lockedBalance > 0) {
      votingPower = votingPower.add(lockedBalance.mul(33).div(100));
    }
    
    // Add unlocked balance
    uint256 govTokenBalance = govToken.balanceOf(owner);
    if (govTokenBalance > 0) {
      votingPower = votingPower.add(govTokenBalance.mul(25).div(100));
    }
    
    return votingPower;
  }
}
