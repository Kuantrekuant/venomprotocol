// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMasterBreeder {
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event SendGovernanceTokenReward(
        address indexed user,
        uint256 indexed pid,
        uint256 amount,
        uint256 lockAmount
    );

    function poolId1(address addr) external returns (uint256);
    function userInfo(uint256 poolId, address addr) external view returns (uint256, uint256);
    function poolExistence(IERC20 token) external view returns (bool);

    function poolLength() external view returns (uint256);
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) external;
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external;
    function massUpdatePools() external;
    function updatePool(uint256 _pid) external;
    function getMultiplier(uint256 _from, uint256 _to) external view returns (uint256);
    function getPoolReward(uint256 _from, uint256 _to, uint256 _allocPoint) external view returns (
      uint256 forDev,
      uint256 forFarmer,
      uint256 forLP,
      uint256 forCom,
      uint256 forFounders
    );
    function pendingReward(uint256 _pid, address _user) external view returns (uint256);
    function claimRewards(uint256[] memory _pids) external;
    function claimReward(uint256 _pid) external;
    function getGlobalAmount(address _user) external view returns (uint256);
    function getGlobalRefAmount(address _user) external view returns (uint256);
    function getTotalRefs(address _user) external view returns (uint256);
    function getRefValueOf(address _user, address _user2) external view returns (uint256);
    function deposit(uint256 _pid, uint256 _amount, address _ref) external;
    function withdraw(uint256 _pid, uint256 _amount, address _ref) external;
    function emergencyWithdraw(uint256 _pid) external;
    function dev(address _devaddr) external;
    function bonusFinishUpdate(uint256 _newFinish) external;
    function halvingUpdate(uint256[] memory _newHalving) external;
    function lpUpdate(address _newLP) external;
    function comUpdate(address _newCom) external;
    function founderUpdate(address _newFounder) external;
    function rewardUpdate(uint256 _newReward) external;
    function rewardMulUpdate(uint256[] memory _newMulReward) external;
    function lockUpdate(uint256 _newlock) external;
    function lockdevUpdate(uint256 _newdevlock) external;
    function locklpUpdate(uint256 _newlplock) external;
    function lockcomUpdate(uint256 _newcomlock) external;
    function lockfounderUpdate(uint256 _newfounderlock) external;
    function starblockUpdate(uint256 _newstarblock) external;
    function getNewRewardPerBlock(uint256 pid1) external view returns (uint256);
    function userDelta(uint256 _pid) external view returns (uint256);
    function reviseWithdraw(uint256 _pid, address _user, uint256 _block) external;
    function reviseDeposit(uint256 _pid, address _user, uint256 _block) external;
    function setStageStarts(uint256[] memory _blockStarts) external;
    function setStageEnds(uint256[] memory _blockEnds) external;
    function setUserFeeStage(uint256[] memory _userFees) external;
    function setDevFeeStage(uint256[] memory _devFees) external;
    function setDevDepFee(uint256 _devDepFees) external;
    function setUserDepFee(uint256 _usrDepFees) external;
    function reclaimTokenOwnership(address _newOwner) external;
}
