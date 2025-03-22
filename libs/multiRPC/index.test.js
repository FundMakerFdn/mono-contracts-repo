import { MultiChainRPC, ViewPolicy } from './index.js';
import {
  createPublicClient,
  http
} from 'viem';

// Example ABI for a token contract with Transfer event
const tokenAbi = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "spender", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Approval",
    "type": "event"
  }
];

// Define chain configurations
const chainConfigs = {
  // Ethereum Mainnet
  1: {
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    contractAbi: tokenAbi,
    rpcUrls: {
      view: {
        1: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com'],
        2: ['https://eth-mainnet.public.blastapi.io']
      },
      transaction: {
        1: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com'],
        2: ['https://eth-mainnet.public.blastapi.io']
      }
    }
  },
  // Polygon
  137: {
    contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
    contractAbi: tokenAbi,
    rpcUrls: {
      view: {
        1: ['https://polygon.llamarpc.com', 'https://polygon-mainnet.public.blastapi.io'],
        2: ['https://polygon.drpc.org']
      },
      transaction: {
        1: ['https://polygon.llamarpc.com', 'https://polygon-mainnet.public.blastapi.io'],
        2: ['https://polygon.drpc.org']
      }
    }
  }
};

// Helper function to test each provider by fetching the latest block
async function testProviders() {
  console.log('\n--- Testing RPC Providers ---');
  
  for (const chainId of Object.keys(chainConfigs)) {
    const chainIdNum = parseInt(chainId);
    console.log(`\nTesting providers for Chain ID ${chainId}:`);
    
    // Get all unique RPC URLs for this chain
    const allUrls = new Set([
      ...chainConfigs[chainId].rpcUrls.view[1],
      ...chainConfigs[chainId].rpcUrls.view[2],
      ...chainConfigs[chainId].rpcUrls.transaction[1],
      ...chainConfigs[chainId].rpcUrls.transaction[2]
    ]);
    
    // Test each URL
    for (const url of allUrls) {
      try {
        const provider = createPublicClient({
          transport: http(url),
          chain: { id: chainIdNum }
        });
        
        const blockNumber = await provider.getBlockNumber();
        console.log(`  ✓ ${url}: Block #${blockNumber}`);
      } catch (error) {
        console.log(`  ✗ ${url}: Error - ${error.message}`);
      }
    }
  }
}

// Example usage
async function main() {
  console.log('Starting MultiChainRPC Tests...');
  
  try {
    // Basic provider connectivity test
    await testProviders();
    
    // Initialize MultiChainRPC with configurations
    const multiChainRpc = new MultiChainRPC(chainConfigs, {
      viewPolicy: ViewPolicy.MostUpdated,
      logLevel: 'info'
    });
    
    // Setup providers and contracts for all chains
    await multiChainRpc.setup();
    console.log('\nMultiChainRPC setup complete');
    
    // Test 1: Get Block Numbers
    console.log('\n--- Test 1: Get Current Block Numbers ---');
    
    for (const chainId of Object.keys(chainConfigs)) {
      const chainIdNum = parseInt(chainId);
      try {
        const blockNumber = await multiChainRpc.getBlockNumber(chainIdNum);
        console.log(`Chain ${chainId} current block: ${blockNumber}`);
        
        // Also get a block
        try {
          const block = await multiChainRpc.getBlock('latest', false, chainIdNum);
          console.log(`Chain ${chainId} latest block hash: ${block.hash.slice(0, 10)}...`);
        } catch (error) {
          console.log(`Chain ${chainId} get block error: ${error.message}`);
        }
      } catch (error) {
        console.log(`Chain ${chainId} block number error: ${error.message}`);
      }
    }
    
    // Test 2: Direct Provider Usage
    console.log('\n--- Test 2: Direct Provider Test ---');
    
    try {
      // Create a direct provider for Ethereum
      const provider = createPublicClient({
        transport: http('https://eth.llamarpc.com'),
        chain: { id: 1 }
      });
      
      // Get USDC contract address
      const contractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      
      // Get current block
      const currentBlock = await provider.getBlockNumber();
      console.log(`Current Ethereum block: ${currentBlock}`);
      
      // Get a specific balance
      try {
        const balance = await provider.readContract({
          address: contractAddress,
          abi: tokenAbi,
          functionName: 'balanceOf',
          args: ['0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503']
        });
        
        console.log(`USDC Balance: ${balance / 10n**6n} USDC`);
      } catch (error) {
        console.log(`Balance read error: ${error.message}`);
      }
      
      // Compare to MultiChainRPC behavior
      try {
        // Call balanceOf via MultiChainRPC
        const balance = await multiChainRpc.callViewFunction(
          'balanceOf', 
          'latest', 
          ['0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'], 
          1
        );
        
        console.log(`MultiChainRPC USDC Balance: ${balance / 10n**6n} USDC`);
      } catch (error) {
        console.log(`MultiChainRPC balance error: ${error.message}`);
      }
    } catch (error) {
      console.log(`Direct provider test error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('\nTests completed');
}

// Test 3: Direct Provider Event Testing
async function testDirectEvents() {
  console.log('\n--- Test 3: Direct Provider Event Test ---');
  
  try {
    // Create a direct provider for Ethereum
    const provider = createPublicClient({
      transport: http('https://eth.llamarpc.com'),
      chain: { id: 1 }
    });
    
    // Get USDC contract address
    const contractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 100n; // Just look at recent blocks
    
    console.log(`Fetching Transfer events from block ${fromBlock} to ${currentBlock}...`);
    
    try {
      // Get events directly using viem's getLogs
      const events = await provider.getLogs({
        address: contractAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
          ]
        },
        fromBlock,
        toBlock: currentBlock
      });
      
      console.log(`Found ${events.length} Transfer events`);
      
      if (events.length > 0) {
        // Display first event
        const event = events[0];
        console.log(`Sample Transfer: From ${event.args.from} To ${event.args.to}, Value: ${event.args.value.toString()}`);
      }
    } catch (error) {
      console.log(`Event retrieval error: ${error.message}`);
    }
  } catch (error) {
    console.log(`Direct event test error: ${error.message}`);
  }
}

// Run the main function
main().catch(console.error).then(() => {
  // After main test completes, try direct event testing
  testDirectEvents().catch(console.error);
});