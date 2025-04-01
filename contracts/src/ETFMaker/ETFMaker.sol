// ETF.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";  
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../PSYMM/PSYMM.sol";
import "./ETF.sol";

contract ETFMaker {
    event ETFDeployed(address indexed etfAddress);
    
    address public immutable pSymmAddress;

    constructor(address _pSymmAddress) {
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call"); 
        _;
    }

    function deployETF(
        string memory _name, 
        string memory _symbol, 
        bytes32 _custodyId, 
        address _collateralToken, 
        uint256 _collateralTokenPrecision,
        uint256 _mintFee,
        uint256 _burnFee,
        uint256 _managementFee,
        uint256 _initialPrice  // Fixed spelling
    ) external onlyPSymm returns (address) {
        pSymmETF etf = new pSymmETF(
            pSymmAddress, 
            _name, 
            _symbol, 
            _custodyId, 
            _collateralToken, 
            _collateralTokenPrecision, 
            _mintFee, 
            _burnFee, 
            _managementFee, 
            _initialPrice
        );

        emit ETFDeployed(address(etf));
        return address(etf);
    }
}
