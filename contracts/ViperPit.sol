// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// ViperPit is a pit full of vipers with a tendency to breed. The longer you stay, the more Vipers you get.
//
// This contract handles swapping to and from xViper, ViperSwap's staking token.
contract ViperPit is ERC20("ViperPit", "xVIPER") {
    using SafeMath for uint256;
    IERC20 public viper;

    // Define the Viper token contract
    constructor(IERC20 _viper) public {
        viper = _viper;
    }

    // Enter the bar. Pay some SUSHIs. Earn some shares.
    // Locks Viper and mints xViper
    function enter(uint256 _amount) public {
        // Gets the amount of Viper locked in the contract
        uint256 totalViper = viper.balanceOf(address(this));
        // Gets the amount of xViper in existence
        uint256 totalShares = totalSupply();
        // If no xViper exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalViper == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xViper the Viper is worth. The ratio will change overtime, as xViper is burned/minted and Viper deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalViper);
            _mint(msg.sender, what);
        }
        // Lock the Viper in the contract
        viper.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your SUSHIs.
    // Unclocks the staked + gained Viper and burns xViper
    function leave(uint256 _share) public {
        // Gets the amount of xViper in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Viper the xViper is worth
        uint256 what =
            _share.mul(viper.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        viper.transfer(msg.sender, what);
    }
}
