// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// The Pit is a pit full of creatures with a tendency to breed.
// The longer you stay, the more creatures you end up with when you leave.
// This contract handles swapping to and from xGovernanceToken <> GovernanceToken
contract Pit is ERC20 {
    using SafeMath for uint256;
    IERC20 public govToken;

    // Define the Viper token contract
    constructor(
      string memory _name,
      string memory _symbol,
      IERC20 _govToken
    ) public ERC20(_name, _symbol) {
        govToken = _govToken;
    }

    // Enter the bar. Pay some SUSHIs. Earn some shares.
    // Locks Viper and mints xViper
    function enter(uint256 _amount) public {
        // Gets the amount of Viper locked in the contract
        uint256 totalViper = govToken.balanceOf(address(this));
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
        govToken.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your SUSHIs.
    // Unclocks the staked + gained Viper and burns xViper
    function leave(uint256 _share) public {
        // Gets the amount of xViper in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Viper the xViper is worth
        uint256 what =
            _share.mul(govToken.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        govToken.transfer(msg.sender, what);
    }
}
