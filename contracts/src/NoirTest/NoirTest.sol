import {UltraVerifier} from "./Verifier.sol";
import "hardhat/console.sol";

contract NoirTest {
    UltraVerifier public verifier = new UltraVerifier();

    function verify(bytes calldata proof, bytes32 root) external view returns (bool) {
        // Create a memory array of bytes32, each contains a byte from root, starting from leftmost (big endian)
        bytes32[] memory choppedRoot = new bytes32[](32);
        
        // Split the root bytes32 into individual bytes
        for (uint i = 0; i < 32; i++) {
            // Shift right by (31-i)*8 bits to get the desired byte to the rightmost position
            // Then mask with 0xff to keep only that byte
            uint8 byteVal = uint8(uint256(root) >> ((31-i) * 8) & 0xff);
            choppedRoot[i] = bytes32(uint256(byteVal));
        }

        bool result = verifier.verify(proof, choppedRoot);
        return result;
    }
}

