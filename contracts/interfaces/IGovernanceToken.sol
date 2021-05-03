// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IGovernanceToken {
    // IERC20
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    // EIP 2612
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    // GovernanceToken
    event Lock(address indexed to, uint256 value);

    function cap() external view returns (uint256);
    function capUpdate(uint256 _newCap) external;
    function lockFromUpdate(uint256 _newLockFrom) external;
    function lockToUpdate(uint256 _newLockTo) external;
    function unlockedSupply() external view returns (uint256);
    function lockedSupply() external view returns (uint256);
    function circulatingSupply() external view returns (uint256);
    function totalLock() external view returns (uint256);
    function mint(address _to, uint256 _amount) external;
    function manualMint(address _to, uint256 _amount) external;
    function totalBalanceOf(address _holder) external view returns (uint256);
    function lockOf(address _holder) external view returns (uint256);
    function lastUnlockBlock(address _holder) external view returns (uint256);
    function lock(address _holder, uint256 _amount) external;
    function canUnlockAmount(address _holder) external view returns (uint256);
    function unlock() external;
    function transferAll(address _to) external;

    // Copied and modified from YAM code:
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernanceStorage.sol
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernance.sol
    // Which is copied and modified from COMPOUND:
    // https://github.com/compound-finance/compound-protocol/blob/master/contracts/Governance/Comp.sol

    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    function delegates(address delegator) external view returns (address);
    function delegate(address delegatee) external;
    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
    function getCurrentVotes(address account) external view returns (uint256);
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256);
}
