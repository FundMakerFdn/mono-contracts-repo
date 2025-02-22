import {UltraVerifier} from "./Verifier.sol";
import "hardhat/console.sol";

contract NoirTest {
    UltraVerifier public verifier = new UltraVerifier();

    function verify(bytes calldata proof, bytes32 y) external view returns (bool) {
		// console.log("here1 %s", uint8(proof[0]));
        bytes32[] memory publicInputs = new bytes32[](1);
		// console.log("here2 %s", uint256(y));
        publicInputs[0] = y;
		// console.log("here3 %s", uint256(publicInputs[0]));
        bool result = verifier.verify(proof, publicInputs);
		// console.log("here4");
        return result;
    }
}

