fn main(leaf: [u8; 32], index: Field, hash_path: [[u8; 32]; 3], root: pub [u8; 32]) {
    let index_bits: [u1; 3] = index.to_le_bits();
    let mut current = leaf;
    for i in 0..3 {
        let path_bit = index_bits[i] as bool;
        let (hash_left, hash_right) = if path_bit {
            (hash_path[i], current)
        } else {
            (current, hash_path[i])
        };
		let mut acc: [u8; 64] = [0; 64];
		for i in 0..32 {
			acc[i] = hash_left[i];
			acc[i + 32] = hash_right[i];
		}
        current = std::hash::keccak256(acc, acc.len());
    }
    assert(current == root);
}

#[test]
fn test_main() {
    let leaf: [u8; 32] = [114, 172, 58, 74, 190, 127, 133, 9, 11, 63, 108, 129, 134, 243, 30, 252, 177, 10, 196, 126, 16, 225, 30, 189, 205, 80, 117, 7, 7, 87, 216, 213];
    let index: Field = 2;
    let hash_path: [[u8; 32]; 3] = [
		[67, 172, 14, 118, 255, 19, 245, 209, 172, 77, 245, 188, 190, 143, 204, 76, 135, 88, 229, 3, 222, 59, 125, 133, 212, 105, 84, 91, 74, 185, 251, 71],
		[208, 78, 65, 115, 206, 133, 247, 163, 247, 9, 82, 202, 197, 51, 243, 110, 77, 234, 166, 55, 39, 164, 44, 136, 19, 15, 33, 58, 175, 96, 57, 1],
		[8, 245, 83, 157, 193, 165, 51, 50, 122, 18, 115, 126, 108, 208, 78, 246, 121, 55, 43, 11, 42, 212, 234, 94, 193, 253, 107, 192, 185, 125, 65, 47],
	];
    let expected_root: [u8; 32] = [246, 79, 65, 239, 160, 200, 170, 170, 23, 163, 234, 215, 13, 229, 172, 86, 98, 194, 179, 141, 68, 226, 41, 52, 135, 107, 3, 72, 181, 171, 191, 36];
    main(leaf, index, hash_path, expected_root);
}
