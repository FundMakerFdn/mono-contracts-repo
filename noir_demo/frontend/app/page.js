'use client'
import { useState, useEffect } from 'react';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { hardhat } from 'viem/chains';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import contract artifacts
import { contracts } from '@/src/contracts.json'
import { abi as MockTokenAbi } from "@/artifacts/contracts/MockPPM.sol/MockToken.json"
import { abi as MockDepositAbi } from "@/artifacts/contracts/MockPPM.sol/MockDeposit.json"

const MOCK_TOKEN_ADDRESS = contracts.MockToken;
const MOCK_DEPOSIT_ADDRESS = contracts.MockDeposit;

export default function TradingInterface() {
  const [isDeposited, setIsDeposited] = useState(false);
  const [positions, setPositions] = useState([]);
  const [collateral, setCollateral] = useState({ balance: '0', upnl: '0' });
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const depositAmount = BigInt('1000000000000000000'); // 1 ETH in wei

  const handleDeposit = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
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

      // Approve token spending
      const approveTx = await walletClient.writeContract({
        address: MOCK_TOKEN_ADDRESS,
        abi: MockTokenAbi,
        functionName: 'approve',
        args: [MOCK_DEPOSIT_ADDRESS, depositAmount],
        account
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Deposit tokens
      const depositTx = await walletClient.writeContract({
        address: MOCK_DEPOSIT_ADDRESS,
        abi: MockDepositAbi,
        functionName: 'deposit',
        args: [depositAmount],
        account
      });

      await publicClient.waitForTransactionReceipt({ hash: depositTx });
      
      setIsDeposited(true);
      alert('Deposit successful!');
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Deposit failed: ' + error.message);
    }
  };

  const handleBuy = async () => {
    if (!isDeposited) {
      alert('Please deposit first');
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
            <button 
              onClick={handleDeposit}
              disabled={isDeposited}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              Deposit
            </button>
            <div className="text-sm text-gray-600">
              Balance: {collateral.balance} USDC
              <br />
              uPNL: {collateral.upnl} USDC
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
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