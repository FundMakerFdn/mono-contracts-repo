// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockAaveSMA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../MockPPM/MockPPM.sol";
import "hardhat/console.sol";


contract ETFMakerFactory {
    address public immutable pSymmAddress;

  
    constructor(address _pSymmAddress) {
        pSymmAddress = _pSymmAddress;
    }


    function deployETF(
        string memory _name, 
        string memory _symbol, 
        address _etfMakerRegistryAddress, 
        bytes32 _custodyId, 
        address _collateralToken, 
        uint256 _collateralTokenPrecision
    ) external onlyPSymm returns (address) {
        pSymmETF etf = new pSymmETF(pSymmAddress, _name, _symbol, _etfMakerRegistryAddress, _custodyId, _collateralToken, _collateralTokenPrecision);
        etfs[_custodyId] = ETF({
            name: _name,
            symbol: _symbol,
            pSymmAddress: pSymmAddress,
            custodyId: _custodyId,
            collateralToken: _collateralToken,
            collateralTokenPrecision: _collateralTokenPrecision

        });
        return address(etf);
    }
}


/*
{
    //PPM
        address solver;

}
*/

contract pSymmETF is ERC20 {

    
    mapping(uint256 => bytes) public currentWeights; //timestamp => weights
    mapping(uint256 => bytes) public solverWeights; //timestamp => weights
 // hi
    uint256 public lastWeightUpdate;

    address public immutable pSymmAddress;
    bytes32 public immutable custodyId;

    uint256 public cumRebalanceSpread;
    uint256 public lastPrice;

    address public immutable collateralToken;
    uint256 public mintFee;
    uint256 public burnFee;
    uint256 public managementFee;
    uint256 public minNoticePeriod;

    address public curator;
    

    constructor( address _etfMakerRegistryAddress, bytes32 _custodyId, bytes memory _weights) ERC20(_name, _symbol) {
        etfMakerRegistryAddress = _etfMakerRegistryAddress;
        custodyId = _custodyId;
        weights[block.timestamp] = _weights;
    }

    modifier onlyPSymm() {
        require(msg.sender == pSymmAddress, "Only pSymm can call");
        _;
    }

    modifier onlyCurator() {
        require(msg.sender == curator || msg.sender == pSymmAddress, "Only curator can call");
        _;
    }

    //@notice only solver
    function mint(address target, uint256 amount) external onlyPSymm {
        _mint(target, amount);
    }

    //@notice only solver
    function burn(address target, uint256 amount) external onlyPSymm {
        _burn(target, amount);
    }   

    // @notice only solver
    function reportRebalanceSpread(bytes32 _custodyId, uint256 _rebalanceSpread) external onlyPSymm {
        etfs[_custodyId].cumRebalanceSpread += _rebalanceSpread;
        emit rebalanceSpreadReport(_rebalanceSpread, block.timestamp);
    }

    // @notice only Solver can call
    function updatePrice(bytes32 _custodyId) external onlyPSymm {
        etfs[_custodyId].etfMakerRegistryAddress.updatePrice(etfs[_custodyId].etfId);
    }

    // @notice only Solver can call
    function updateSolverWeights(uint256 _timestamp, bytes memory _weights) external onlyPSymm {
        solverWeightsUpdate[_timestamp] = _weights;
    }

    // @notice only Curator can call
    function updateCurrentWeights(uint256 _timestamp, bytes memory _weights) external onlyCurator {
        currentWeightsUpdate[_timestamp] = _weights;
    }

    // @notice only Curator can call
    function updateWeights(uint256 _timestamp, bytes memory _weights) external onlyPSymm {
        require(_timestamp > lastWeightUpdate, "Rebalance timestamp must be greater than the previous one");
        weights[_timestamp] = _weights;
        lastWeightUpdate = _timestamp;
    }

    /* --------- 
    Getters
    --------- */

    function getPrice(bytes32 _custodyId) external view returns (uint256) {
        return lastPrice;
    }

    function getHistoricalPrice(bytes32 _custodyId, uint256 _timestamp) external view returns (uint256) {
        return weights[_timestamp];
    }

    function getCumRebalanceSpread(bytes32 _custodyId) external view returns (uint256) {
        return cumRebalanceSpread;
    }

    function getCurrentWeights(bytes32 _custodyId) external view returns (bytes memory) {
        return currentWeights[block.timestamp];
    }

    function getSolverWeights(bytes32 _custodyId) external view returns (bytes memory) {
        return solverWeights[block.timestamp];
    }
}