// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../BaseSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./pSymm.sol"; // Import the pSymm contract
import "hardhat/console.sol";

/// @title pSymm Settlement Contract
contract pSymmSettlement is BaseSettlement {
    using SafeERC20 for IERC20;
    
    struct pSymmParameters {
        address partyA;
        address partyB;
        uint256 subAccountId;
        uint256 collateralAmount;
        address collateralToken;
        bytes32 MA_A;
        bytes32 MA_B;
        bool isManaged;
        bytes32 merkleRootA;
        uint256 timestampA;
        bytes32 merkleRootB;
        uint256 timestampB;
        address _pSymmAddres;
    }

    bytes32 private constant pSymm_SETTLEMENT_TYPEHASH = 
        keccak256("pSymmSettlement(address partyA,address partyB,uint256 subAccountId,uint256 collateralAmount,address collateralToken,bytes32 merkleRootA,bytes32 merkleRootB)");

    mapping(bytes32 => pSymmParameters) private pSymmParametersMapping;

    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) BaseSettlement(_settleMaker, name, version) {}

    /// @notice Create a new pSymm settlement with the provided parameters
    function createpSymmSettlement(
        pSymmParameters calldata params
    ) external returns (bytes32) {
        require(params.pSymm != address(0), "Invalid pSymm address");
        bytes32 settlementId = createSettlement(
            params.partyA,
            params.partyB,
            params.collateralAmount,
            params.collateralToken
        );
        
        pSymmParametersMapping[settlementId] = pSymmParameters({
            partyA: params.partyA,
            partyB: params.partyB,
            subAccountId: params.subAccountId,
            collateralAmount: params.collateralAmount,
            collateralToken: params.collateralToken,
            MA_A: params.MA_A,
            MA_B: params.MA_B,
            isManaged: params.isManaged,
            merkleRootA: "0x00",
            timestampA: 0,
            merkleRootB: "0x00",
            timestampB: 0,
            _pSymmAddres: params._pSymmAddres
        });
        
        emit SettlementCreated(settlementId, params);
        return settlementId;
    }

    function submitMerkleRoot(bytes32 settlementId, bytes32 merkleRoot) external {
       if (pSymmParametersMapping[settlementId].partyA == msg.sender) {
        pSymmParametersMapping[settlementId].merkleRootA = merkleRoot;
        pSymmParametersMapping[settlementId].timestampA = block.timestamp;
       } else if (pSymmParametersMapping[settlementId].partyB == msg.sender) {
        pSymmParametersMapping[settlementId].merkleRootB = merkleRoot;
        pSymmParametersMapping[settlementId].timestampB = block.timestamp;
       }
    }

    /// @notice Execute an early agreement with additional parameters
    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 partyAAmount,
        uint256 partyBAmount,
        bytes memory signature
    ) public override {
        SettlementData storage settlement = settlements[settlementId];
        pSymmParameters storage params = pSymmParametersMapping[settlementId];

        // Call parent implementation first for signature verification
        super.executeEarlyAgreement(
            settlementId,
            partyAAmount,
            partyBAmount,
            signature
        );
        
        pSymm pSymmContract = pSymm(params.pSymm);
        
        IERC20(params.collateralToken).safeApprove(address(pSymmContract), params.collateralAmount);
        
        pSymmContract.deposit(params.collateralToken, partyAAmount);
        
        pSymmContract.deposit(params.collateralToken, partyBAmount);
    
        IERC20(params.collateralToken).safeApprove(address(pSymmContract), 0);
    }

    /// @notice Open a settlement with all necessary parameters
    function openSettlement(
        bytes32 settlementId,
        address partyA,
        address partyB,
        uint256 collateralAmount,
        address collateralToken,
        bytes32 MA_A,
        bytes32 MA_B,
        bool isManaged,
        bytes32 merkleRootA,
        bytes32 merkleRootB
    ) external {
        pSymmParameters storage params = pSymmParametersMapping[settlementId];
        
        // Ensure that the caller is the authorized pSymm contract
        require(msg.sender == params.pSymm, "Unauthorized caller");

        // Update parameters if needed
        params.MA_A = MA_A;
        params.MA_B = MA_B;
        params.isManaged = isManaged;
        params.merkleRootA = merkleRootA;
        params.merkleRootB = merkleRootB;

        // Implement settlement opening logic here
        // Example: Transfer collateral from parties to settlement contract
        IERC20(collateralToken).safeTransferFrom(partyA, address(this), collateralAmount);
        IERC20(collateralToken).safeTransferFrom(partyB, address(this), collateralAmount);

        // Update settlement state if applicable
        // settlements[settlementId].state = SettlementState.Open;

        emit SettlementOpened(
            settlementId, 
            partyA, 
            partyB, 
            collateralAmount, 
            collateralToken, 
            MA_A, 
            MA_B, 
            isManaged, 
            merkleRootA, 
            merkleRootB
        );
    }

    /// @notice Retrieve pSymm parameters for a given settlement ID
    function getpSymmParameters(bytes32 settlementId) external view returns (pSymmParameters memory) {
        return pSymmParametersMapping[settlementId];
    }

    /// @notice Event emitted when a settlement is created
    event SettlementCreated(bytes32 indexed settlementId, pSymmParameters params);

    /// @notice Event emitted when a settlement is opened
    event SettlementOpened(
        bytes32 indexed settlementId,
        address indexed partyA,
        address indexed partyB,
        uint256 collateralAmount,
        address collateralToken,
        bytes32 MA_A,
        bytes32 MA_B,
        bool isManaged,
        bytes32 merkleRootA,
        bytes32 merkleRootB
    );
}
