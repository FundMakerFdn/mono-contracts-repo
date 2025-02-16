// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockAaveSMA.sol";

contract AaveSMAFactory {
    address public immutable pSymmAddress;

    constructor(address _pSymmAddress) {
        require(_pSymmAddress != address(0), "Invalid pSymm address");
        pSymmAddress = _pSymmAddress;
    }

	// TODO: Accept bytes memory data, decode to params struct, validate params, pass to AaveSMA
    function deploySMA() external returns (address) {
        MockAaveSMA sma = new MockAaveSMA(pSymmAddress);
        return address(sma);
    }
}
