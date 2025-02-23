fn compute_merkle_root<let N: u32>(leaf: [u8; 32], index: Field, hash_path: [[u8; 32]; N]) -> [u8; 32] {
    let index_bits: [u1; N] = index.to_le_bits();
    let mut current = leaf;
    for i in 0..N {
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
    current
}

struct Note {
    nullifier: [u8; 32],
    amount: [u8; 32], // LE-encoded (0x1234.. = [.., 0x34, 0x12])
    token: [u8; 20],
    custody_id: [u8; 32],
    secret_nonce: [u8; 32],
}

fn hashNote(note: Note) -> [u8; 32] {
    let mut acc: [u8; 160] = [0; 160]; // 32 * 5 = 160 bytes
    
    // Concatenate all inputs
    for i in 0..32 {
        acc[i] = note.nullifier[i];
        acc[i + 32] = note.amount[i];
        acc[i + 64] = note.token[i];
        acc[i + 96] = note.custody_id[i];
        acc[i + 128] = note.secret_nonce[i];
    }
    
    // Hash the concatenated array
    std::hash::keccak256(acc, acc.len())
}

// CTC
// Split note into note_a + note_b
fn main(
    note: Note, note_a: Note, note_b: Note,
    note_index: Field, note_hash_path: [[u8; 32]; 30], // commitment merkle
    note_commitment: [u8; 32],
    noteA_commitment: [u8; 32],
    noteB_commitment: [u8; 32],
    nullifier_hash: pub [u8; 32], root: pub [u8; 32]
) {
    // Verify nullifier hash
    let computed_nullifier = std::hash::keccak256(note.nullifier, note.nullifier.len());
    assert(nullifier_hash == computed_nullifier);

    // Verify note commitment
    let computed_note_commitment = hashNote(note);
    assert(note_commitment == computed_note_commitment);

    // Verify merkle root
    let computed_root = compute_merkle_root(note_commitment, note_index, note_hash_path);
    assert(root == computed_root);

    // Verify tokens match
    for i in 0..32 {
        assert(note.token[i] == note_a.token[i]);
        assert(note.token[i] == note_b.token[i]);
    }

    // Verify amount splitting (byte by byte addition with carry)
	// LeToInt(note.amount) == LEtoInt(noteA.amount) + LEtoInt(noteB.amount)
    let mut carry: u8 = 0;
    for i in 0..32 {
        let sum = (note_a.amount[i] as u16) + (note_b.amount[i] as u16) + (carry as u16);
        assert(note.amount[i] == (sum % 256) as u8);
        carry = (sum / 256) as u8;
    }
    assert(carry == 0); // Ensure no overflow

    // Verify note commitments
    let computed_noteA_commitment = hashNote(note_a);
    let computed_noteB_commitment = hashNote(note_b);
    assert(noteA_commitment == computed_noteA_commitment);
    assert(noteB_commitment == computed_noteB_commitment);
}

// #[test]
// fn test_main() {
//     let leaf: [u8; 32] = [114, 172, 58, 74, 190, 127, 133, 9, 11, 63, 108, 129, 134, 243, 30, 252, 177, 10, 196, 126, 16, 225, 30, 189, 205, 80, 117, 7, 7, 87, 216, 213];
//     let index: Field = 2;
//     let hash_path: [[u8; 32]; 3] = [
// 		[67, 172, 14, 118, 255, 19, 245, 209, 172, 77, 245, 188, 190, 143, 204, 76, 135, 88, 229, 3, 222, 59, 125, 133, 212, 105, 84, 91, 74, 185, 251, 71],
// 		[208, 78, 65, 115, 206, 133, 247, 163, 247, 9, 82, 202, 197, 51, 243, 110, 77, 234, 166, 55, 39, 164, 44, 136, 19, 15, 33, 58, 175, 96, 57, 1],
// 		[8, 245, 83, 157, 193, 165, 51, 50, 122, 18, 115, 126, 108, 208, 78, 246, 121, 55, 43, 11, 42, 212, 234, 94, 193, 253, 107, 192, 185, 125, 65, 47],
// 	];
//     let expected_root: [u8; 32] = [246, 79, 65, 239, 160, 200, 170, 170, 23, 163, 234, 215, 13, 229, 172, 86, 98, 194, 179, 141, 68, 226, 41, 52, 135, 107, 3, 72, 181, 171, 191, 36];
//     main(leaf, index, hash_path, expected_root);
// }
