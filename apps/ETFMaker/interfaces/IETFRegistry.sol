// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IETFRegistry {
    struct ETF {
        uint256 updateFrequency;
        address publisher;
    }

    function registerETF(ETF calldata etf) external;
    function updateWeights() external;
    function updatePrice() external;
    function getPrice(uint256 etfId) external view returns (uint256);
}
