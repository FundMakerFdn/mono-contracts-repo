'use client'
import { useState, useEffect } from 'react';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { hardhat } from 'viem/chains';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import contract artifacts
import { contracts } from '@/src/contracts.json';
import { abi as MockTokenAbi } from "@/artifacts/contracts/MockPPM.sol/MockToken.json";
import { abi as NoirPsymmAbi } from "@/artifacts/contracts/noirPsymm.sol/noirPsymm.json";

const MOCK_TOKEN_ADDRESS = contracts.MockToken;
const NOIR_PSYMM_ADDRESS = contracts.noirPsymm;

export default function TradingInterface() {
  const [depositBalance, setDepositBalance] = useState('0');
  const [isDeposited, setIsDeposited] = useState(false);
  const [positions, setPositions] = useState([]);
  const [collateral, setCollateral] = useState({ balance: '0', upnl: '0' });
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [mintedBalance, setMintedBalance] = useState('0');
  const DECIMALS = 18; // Standard ERC20 decimals
  const TOKEN_UNIT = BigInt('1' + '0'.repeat(DECIMALS)); // 1 token in base units
  const depositAmount = TOKEN_UNIT * BigInt(1000); // 1 ETH in wei

  // Initialize clients
  const setupClients = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask');
      return null;
    }

    const publicClient = createPublicClient({
      chain: hardhat,
      transport: custom(window.ethereum)
    });

    const walletClient = createWalletClient({
      chain: hardhat,
      transport: custom(window.ethereum)
    });

    const [account] = await walletClient.requestAddresses();

    return { publicClient, walletClient, account };
  };

  const handleMint = async () => {
    try {
      const clients = await setupClients();
      if (!clients) return;
      const { walletClient, publicClient, account } = clients;

      const mintTx = await walletClient.writeContract({
        address: MOCK_TOKEN_ADDRESS,
        abi: MockTokenAbi,
        functionName: 'mint',
        args: [account, depositAmount],
        account
      });

      const mintData = await publicClient.waitForTransactionReceipt({ hash: mintTx });
      console.log("mint data: ", mintData);
      await updateMintedBalance(account);
      alert('Mint successful!');
    } catch (error) {
      console.error('Mint error:', error);
      alert('Mint failed: ' + error.message);
    }
  };

  const handleApproveDeposit = async () => {
    try {
      const clients = await setupClients();
      if (!clients) return;
      const { walletClient, publicClient, account } = clients;

      const approveTx = await walletClient.writeContract({
        address: MOCK_TOKEN_ADDRESS,
        abi: MockTokenAbi,
        functionName: 'approve',
        args: [NOIR_PSYMM_ADDRESS, depositAmount],
        account
      });

      const approveData = await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log("approve: ", approveData);
      alert('Approval successful!');
    } catch (error) {
      console.error('Approve error:', error);
      alert('Approve failed: ' + error.message);
    }
  };

  const handleAddressToCustody = async () => {
    try {
      const clients = await setupClients();
      if (!clients) return;
      const { walletClient, publicClient, account } = clients;

      const commitment = "0x" + Array(64).fill("0").join("");

      const depositTx = await walletClient.writeContract({
        address: NOIR_PSYMM_ADDRESS,
        abi: NoirPsymmAbi,
        functionName: 'addressToCustody',
        args: [commitment, depositAmount, MOCK_TOKEN_ADDRESS],
        account
      });

      const custodyData = await publicClient.waitForTransactionReceipt({ hash: depositTx });
      console.log("custodyData: ", custodyData)
      setIsDeposited(true);
      alert('Deposit to custody successful!');
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Deposit failed: ' + error.message);
    }
  };

  const updateDepositBalance = async (account) => {
    try {
      const publicClient = createPublicClient({
        chain: hardhat,
        transport: custom(window.ethereum)
      });

      const depositFilter = await publicClient.createContractEventFilter({
        address: NOIR_PSYMM_ADDRESS,
        abi: NoirPsymmAbi,
        eventName: 'Deposit',
        fromBlock: 0n
      });

      const deposits = await publicClient.getFilterLogs({
        filter: depositFilter
      });

      console.log('Deposit events:', deposits);

      const totalDeposits = deposits.reduce((acc, log) => {
        if (log && log.args) {
          const { commitment, index, timestamp } = log.args;
          console.log('Deposit event details:', { commitment, index, timestamp });
        }
        return acc;
      }, BigInt(0));

      setDepositBalance(totalDeposits.toString());
    } catch (error) {
      console.error('Error fetching deposit events:', error);
    }
  };

  const handleApproveWithdraw = async () => {
    alert('Approve withdraw functionality coming soon!');
  };

  const handleWithdraw = async () => {
    alert('Withdraw functionality coming soon!');
  };

  const updateMintedBalance = async (account) => {
    try {
      const publicClient = createPublicClient({
        chain: hardhat,
        transport: custom(window.ethereum)
      });

      const balance = await publicClient.readContract({
        address: MOCK_TOKEN_ADDRESS,
        abi: MockTokenAbi,
        functionName: 'balanceOf',
        args: [account]
      });

      setMintedBalance(balance.toString());
    } catch (error) {
      console.error('Error fetching minted balance:', error);
    }
  };

  const handleBuy = async () => {
    if (!isDeposited) {
      alert('Please complete deposit process first');
      return;
    }

    if (!orderPrice || !orderQuantity) {
      alert('Please enter price and quantity');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/partyA/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: orderPrice,
          quantity: orderQuantity
        })
      });

      if (!response.ok) throw new Error('Buy order failed');

      alert('Buy order sent successfully!');
      setOrderPrice('');
      setOrderQuantity('');
    } catch (error) {
      console.error('Buy error:', error);
      alert('Buy failed: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Update minted balance
        if (window.ethereum) {
          const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
          await updateMintedBalance(account);
          await updateDepositBalance(account);
        }

        // Fetch positions
        const posResponse = await fetch('http://localhost:3001/api/partyA/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const posData = await posResponse.json();
        setPositions(posData.positions);

        // Fetch collateral
        const colResponse = await fetch('http://localhost:3001/api/partyA/collateral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const colData = await colResponse.json();
        setCollateral(colData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Trading Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleMint}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Mint
              </button>
              <button
                onClick={handleApproveDeposit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Approve Deposit
              </button>
              <button
                onClick={handleAddressToCustody}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Address To Custody
              </button>
              <button
                onClick={handleApproveWithdraw}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Approve Withdraw
              </button>
              <button
                onClick={handleWithdraw}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Withdraw
              </button>
            </div>
            <div className="text-sm space-y-2">
              <div className="p-2 bg-gray-100 rounded">
                <div>Minted Balance: {mintedBalance} mUSDC</div>
              </div>
              <div className="p-2 bg-gray-100 rounded">
                <div>Custody Balance: {collateral.balance} USDC</div>
                  <div>Deposit Balance: {depositBalance} USDC</div>
                <div>uPNL: {collateral.upnl} USDC</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-center mt-4">
            <input
              type="number"
              placeholder="Price"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              className="border rounded px-3 py-2 w-32"
            />
            <input
              type="number"
              placeholder="Quantity"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value)}
              className="border rounded px-3 py-2 w-32"
            />
            <button
              onClick={handleBuy}
              disabled={!isDeposited}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              Buy
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Order ID</th>
                  <th className="text-left p-3">Side</th>
                  <th className="text-left p-3">Quantity</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Last Price</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.OrderID} className="border-b">
                    <td className="p-3">{position.OrderID}</td>
                    <td className="p-3">{position.Side === '1' ? 'Buy' : 'Sell'}</td>
                    <td className="p-3">{position.CumQty}</td>
                    <td className="p-3">{position.Price}</td>
                    <td className="p-3">{position.LastPx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}