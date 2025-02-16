// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

using SafeERC20 for IERC20;

contract StableMaker is EIP712, IERC20, Ownable {

    IStableRegistry immutable STABLE_REGISTRY;
    uint256 immutable STABLE_ID
    IPSYMM immutable PSYMM;
    bytes32 immutable CUSTODY_ID;
    address immutable COLLATERAL_TOKEN;
    uint256 immutable COLLATERAL_TOKEN_PRECISION


    mapping(address => uint256) private deposited;
    mapping(address => uint256) private yield;



    constructor(
        address stableRegistryAddress,
        uint256 stableId,
        address pSymmAddress,
        bytes32 custodyId,
        address collateralToken,
        uint256 mintFee,
        uint256 burnFee,
        uint256 managementFee,
        address stableProviderAddress
    ) EIP712("StableMaker", "1.0") {
        STABLE_REGISTRY = StableRegistry(stableRegistryAddress)
        PSYMM = pSymm(pSymmAddress)
    }

    modifier onlyPSYMM() {
        require(msg.sender == address(PSYMM), "Only PSYMM can call this function");
        _;
    }
    // solver set mint cap, mint instantly tokens
    function mint(address _to, uint256 _amount) external onlyPSYMM {

    }

    // 0 deposist stable tokens
    // 1 send burn order
    // 2 solver fill
    // 3 solver execute this function as an ECDSA
    function burn(address _to, uint256 _amount) external onlyPSYMM {

    }

    // deposit before sending an EIP712 to solver
    function deposit(uint256 _amount, address _token) external {
        IERC20(_token).safeTransferFrom(msg.sender, _amount);
        PSYMM.addressToCustody( CUSTODY_ID, COLLATERAL_TOKEN, _amount );
        deposited[msg.sender] = _amount;
        // @TODO event
    }

    // Withdraw free collateral // Only callable by solver // or user if there is yield
    function withdraw(uint256 _amount) external {
        uint256 withdrawAmount = 0;
        if (yield[msg.sender] > 0) {
            PSYMM.custodyToAddress(this.address, CUSTODY_ID, COLLATERAL_TOKEN, yield[msg.sender]);
            withdrawAmount += yield[msg.sender];
            yield[msg.sender] = 0;
        if (msg.sender == owner || deposited[msg.sender] > 0) {
            PSYMM.custodyToAddress(this.address, CUSTODY_ID, COLLATERAL_TOKEN, deposited[msg.sender]);
            withdrawAmount += yield[msg.sender];
            deposited[msg.sender] = 0;
        }
        IERC20(COLLATERAL_TOKEN).safeTransfer(msg.sender, deposited[msg.sender]);

    }

    function reportRebalanceSpread(uint256 _rebalanceSpread) external {
        cumRebalanceSpread += _rebalanceSpread;
        emit rebalanceSpreadReport(_rebalanceSpread, block.timestamp);
    }

    // Case where eip712 doesnt work : call pSymm.publishCustodyMsg()
    // Case where solver deposited into custody but doesnt allow withdraw : call settleMaker

    /// Read function

    function getPrice() external pure view return(uint256){
        return ETFREGISTRY.getPrice(ETF_ID) * ( 1e18 - cumulativeRebalanceSpread);
    }

}

contract StableRegistry is Ownable {
    address public SYMM_TOKEN;
    uint256 public SYMM_REGISTRY_FEE;

    mapping(uint256 => address) private publisher; // ECDSA
    mapping(uint256 => mapping(uint256 => bytes)) private weights;
    mapping(uint256 => uint256) private minNoticePeriod;
    mapping(address => bool) private isStableMaker;

    // Fees
    mapping(uint256 => Stable) private stable;

    struct Stable {
        uint256 publisher;
        uint256 minNoticePeriod;
        uint256 rebalanceTimestamp;
        uint256 cumulativeRebalanceSpread;
        uint256 mintFee;
        uint256 burnFee;
        uint256 managementFee;
    }

    uint256 private stableIdLength;
    mapping(uint256 => uint256) private rebalanceTimestamp;

    constructor(address _symmToken, uint256 _symmRegistryFee, address _owner) {
        SYMM_TOKEN = _symmToken;
        SYMM_REGISTRY_FEE = _symmRegistryFee;
        owner = _owner;
    }

    function registerStable( address _publisher, bytes memory _weights, uint256 _rebalanceTimestamp, uint256 _minNoticePeriod, address _stableProvider) external {
        publisher[_stableId] = _publisher;
        minNoticePeriod[_stableId] = _minNoticePeriod;
        stableIdLength++;
        // factory
        stableMaker = address(new StableMaker{salt: salt}(address(this), _stableId, address(PSYMM), CUSTODY_ID, COLLATERAL_TOKEN, MINT_FEE, BURN_FEE, MANAGEMENT_FEE, STABLE_PROVIDER_ADDRESS)));
        isStableMaker[address(stableMaker)] = true;
        // pay fee
    }

    function updateWeights(uint256 _stableId, bytes memory _weights, uint256 _rebalanceTimestamp) external {
        require(publisher[_stableId] == msg.sender, "Not the publisher"); // @TODO multi-sig support
        weights[_stableId] = _weights;
        require(_rebalanceTimestamp > rebalanceTimestamp[_stableId], "Rebalance timestamp must be greater than the previous one");
        require(_rebalanceTimestamp > block.timestamp + minNoticePeriod[_stableId], "Rebalance timestamp must be greater than the min notice period");
        rebalanceTimestamp[_stableId] = _rebalanceTimestamp;
        // burn symm token
        IERC20(SYMM_TOKEN).safeTransferFrom(msg.sender, address(0), SYMM_REGISTRY_FEE);
    }

    function updatePrice(uint256[] memory _stableIds, uint256[] memory _prices) external onlyOwner {
        // update price

    }

    function updateRegistryFee(address token, uint256 _fee) external onlyOwner {
        SYMM_TOKEN = token;
        SYMM_REGISTRY_FEE = _fee;
    }

    // how to insure rebalanc time for the solver

}