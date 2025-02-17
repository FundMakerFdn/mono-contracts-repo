// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";

interface IPSYMM {
    function onlyCustodyOwner(address) external view returns (bool);
    function smaAllowance(bytes32, address) external view returns (bool);
}

contract MockAaveSMA {
    address public immutable pSymmAddress;

    // TODO: Accept AaveSMA params in constructor
    constructor(address _pSymmAddress) {
        require(_pSymmAddress != address(0), "Invalid pSymm address");
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }
    modifier checkCustody(bytes32 custodyId) {
        require(IPSYMM(pSymmAddress).onlyCustodyOwner(address(this)) &&
                IPSYMM(pSymmAddress).smaAllowance(custodyId, address(this)), "Not allowed");
        _;
    }

    function borrow(address token, uint256 minAmount) external view onlyPSymm {
        // borrow minAmount of token
        console.log("Borrow function called with arguments %s %s", token, minAmount);
    }
    function borrow(bytes32 custodyId, address token, uint256 minAmount) external view
    onlyPSymm checkCustody(custodyId) {
        // borrow minAmount of token
        console.log("Borrow function called from custody %s with arguments %s %s", uint256(custodyId), token, minAmount);
    }


    function repay(address token, uint256 amount) external view onlyPSymm {
        // repay amount of token
        console.log("Repay function called with arguments %s %s", token, amount);
    }
    function repay(bytes32 custodyId, address token, uint256 amount) external view
    onlyPSymm checkCustody(custodyId) {
        // repay amount of token
        console.log("Repay function called from custody %s with arguments %s %s", uint256(custodyId), token, amount);
    }

    // function supply, withdraw
}
