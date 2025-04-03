// Index.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";  
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../PSYMM/PSYMM.sol";
import "./Index.sol";

contract IndexFactory {
    event IndexDeployed(address indexed indexAddress);
    
    address public immutable pSymmAddress;

    constructor(address _pSymmAddress) {
        pSymmAddress = _pSymmAddress;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call"); 
        _;
    }

    function deployIndex(
        address _indexRegistryAddress,
        string memory _name, 
        string memory _symbol, 
        bytes32 _custodyId, 
        address _collateralToken, 
        uint256 _collateralTokenPrecision,
        uint256 _mintFee,
        uint256 _burnFee,
        uint256 _managementFee,
        uint256 _maxMintPerBlock,
        uint256 _maxRedeemPerBlock
    ) external onlyPSymm returns (address) {
        pSymmIndex index = new pSymmIndex(
            pSymmAddress, 
            _indexRegistryAddress,
            _name, 
            _symbol, 
            _custodyId, 
            _collateralToken, 
            _collateralTokenPrecision, 
            _mintFee, 
            _burnFee, 
            _managementFee, 
            _maxMintPerBlock,
            _maxRedeemPerBlock
        );

        emit IndexDeployed(address(index));
        return address(index);
    }
}
