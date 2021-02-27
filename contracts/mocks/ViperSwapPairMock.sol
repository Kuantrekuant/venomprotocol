// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@viperswap/core/contracts/UniswapV2Pair.sol";

contract ViperSwapPairMock is UniswapV2Pair {
    constructor() public UniswapV2Pair() {}
}
