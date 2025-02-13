// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockAaveSMAFactory {
    event SMADeployed(address smaAddress, address owner);

    function deploySMA(address owner) external returns (address) {
        // Mock SMA deployment
        address mockSMA = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, owner)))));
        emit SMADeployed(mockSMA, owner);
        return mockSMA;
    }
}
