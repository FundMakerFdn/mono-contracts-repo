// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Settlement.sol";

/// @title PSymm Settlement Contract
abstract contract PSymmSettlement is Settlement {
    struct PSymmParameters {
        uint256 entryPrice;
        uint256 settlementPrice;
        address pSymmContract;
        uint256 derivativeId;
    }
}
