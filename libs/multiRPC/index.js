import {
    createPublicClient,
    createWalletClient,
    http,
    getContract,
    parseGwei,
    formatGwei,
    parseAbiItem,
    parseEventLogs
  } from 'viem';
  
  // Enums
  const ViewPolicy = {
    FirstSuccess: 0,
    MostUpdated: 1
  };
  
  const TxPriority = {
    Low: 'low',
    Medium: 'medium',
    High: 'high'
  };
  
  const GasEstimationMethod = {
    GAS_API_PROVIDER: 0,
    RPC: 1,
    FIXED: 2,
    CUSTOM: 3
  };
  
  const ContractFunctionType = {
    View: "view",
    Transaction: "transaction"
  };
  
  // Constants
  const MAX_RPC_IN_EACH_BRACKET = 3;
  const REQUEST_TIMEOUT = 30000; // 30 seconds
  const DEFAULT_GAS_UPPER_BOUND = 26000;
  const DEFAULT_GAS_LIMIT = 1000000n;
  const DEFAULT_API_PROVIDER = 'https://gas-api.metaswap.codefi.network/networks/{chain_id}/suggestedGasFees';
  const CHAIN_ID_TO_GAS = {
    1: 25,       // Ethereum
    10: 0.1,     // Optimism
    56: 5,       // BSC
    97: 10.1,    // BSC Testnet
    137: 50,     // Polygon
    250: 60,     // Fantom
    42161: 0.1,  // Arbitrum
    43114: 25,   // Avalanche
  };
  const GAS_FROM_RPC_CHAIN_IDS = [56, 8453]; // For these chain IDs use RPC to estimate gas
  const FIXED_VALUE_GAS = 30;
  const DEV_ENV = true;
  const DEFAULT_EVENT_BATCH_SIZE = 10000; // Default batch size for paginated event retrieval
  
  // Error classes
  class Web3InterfaceException extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
    
    toString() {
      return `${this.name}(${this.message})`;
    }
  }
  
  class OutOfRangeTransactionFee extends Web3InterfaceException {}
  class FailedOnAllRPCs extends Web3InterfaceException {}
  class ViewCallFailed extends Web3InterfaceException {}
  class TransactionFailedStatus extends Web3InterfaceException {
    constructor(txHash, funcName, funcArgs, funcKwargs, trace = null) {
      super(`Transaction failed: ${txHash} function=${funcName}`);
      this.txHash = txHash;
      this.funcName = funcName;
      this.funcArgs = funcArgs;
      this.funcKwargs = funcKwargs;
      this.trace = trace;
    }
    
    toString() {
      return `${this.name}(${this.txHash} func=${this.funcName})`;
    }
  }
  class FailedToGetGasPrice extends Web3InterfaceException {}
  class MaximumRPCInEachBracketReached extends Web3InterfaceException {}
  class AtLastProvideOneValidRPCInEachBracket extends Web3InterfaceException {}
  class TransactionValueError extends Web3InterfaceException {}
  class GetBlockFailed extends Web3InterfaceException {}
  class DontHaveThisRpcType extends Web3InterfaceException {}
  class NotValidViewPolicy extends Web3InterfaceException {}
  class ChainIdNotConfigured extends Web3InterfaceException {
    constructor(chainId) {
      super(`Chain ID ${chainId} is not configured in this MultiRPC instance`);
    }
  }
  class EventRetrievalFailed extends Web3InterfaceException {
    constructor(chainId, eventName, error) {
      super(`[Chain ${chainId}] Failed to retrieve events (${eventName}): ${error.message}`);
      this.originalError = error;
    }
  }
  
  // Helper functions
  function getUnixTime() {
    return Math.floor(Date.now());
  }
  
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function raceWithTimeout(promises, timeoutMs = REQUEST_TIMEOUT) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    return Promise.race([...promises, timeoutPromise]);
  }
  
  function reduceListOfList(lists) {
    if (!lists || lists.length === 0) return [];
    return lists.flat();
  }
  
  // NestedDict-like implementation
  class NestedDict {
    constructor(data = {}) {
      this.data = data;
    }
    
    get(keys, defaultValue = null) {
      if (!Array.isArray(keys)) {
        keys = [keys];
      }
      
      let current = this.data;
      for (const key of keys) {
        if (current === undefined || current === null || typeof current !== 'object') {
          return defaultValue;
        }
        current = current[key];
      }
      return current ?? defaultValue;
    }
    
    set(keys, value) {
      if (!Array.isArray(keys)) {
        keys = [keys];
      }
      
      let current = this.data;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = value;
    }
    
    items() {
      const result = [];
      
      function getItemsRecursive(data, currentKeys = []) {
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            getItemsRecursive(value, [...currentKeys, key]);
          } else {
            result.push([[...currentKeys, key], value]);
          }
        }
      }
      
      getItemsRecursive(this.data);
      return result;
    }
  }
  
  // Gas Estimation
  class GasEstimation {
    constructor(chainId, providers, defaultMethod = null, options = {}) {
      this.chainId = chainId;
      this.providers = providers;
      this.defaultMethod = defaultMethod;
      this.gasApiProvider = options.gasApiProvider || DEFAULT_API_PROVIDER;
      
      this.multipliers = {
        [TxPriority.Low]: options.gasMultiplierLow || 1,
        [TxPriority.Medium]: options.gasMultiplierMedium || 1,
        [TxPriority.High]: options.gasMultiplierHigh || 1
      };
      
      this.gasEstimationMethods = {
        [GasEstimationMethod.GAS_API_PROVIDER]: this.getGasFromApi.bind(this),
        [GasEstimationMethod.RPC]: this.getGasFromRpc.bind(this),
        [GasEstimationMethod.FIXED]: this.getFixedValue.bind(this),
        [GasEstimationMethod.CUSTOM]: this.customGasEstimation.bind(this)
      };
      
      this.methodSortedPriority = [
        GasEstimationMethod.GAS_API_PROVIDER,
        GasEstimationMethod.RPC,
        GasEstimationMethod.FIXED,
        GasEstimationMethod.CUSTOM
      ];
    }
    
    loggerParams(params) {
      console.info(`params=${JSON.stringify(params)}`);
    }
    
    async getGasFromApi(priority, gasUpperBound) {
      const gasProvider = this.gasApiProvider.replace('{chain_id}', this.chainId.toString());
      
      try {
        const response = await fetch(gasProvider, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
        if (!response.ok) {
          throw new Error(`Failed to fetch gas from API: ${response.status}`);
        }
        
        const respJson = await response.json();
        const maxFeePerGas = parseFloat(respJson[priority].suggestedMaxFeePerGas);
        const maxPriorityFeePerGas = parseFloat(respJson[priority].suggestedMaxPriorityFeePerGas);
        
        this.loggerParams({
          max_fee_per_gas: maxFeePerGas,
          max_priority_fee_per_gas: maxPriorityFeePerGas,
          gas_price_provider: gasProvider
        });
        
        if (maxFeePerGas > gasUpperBound) {
          throw new OutOfRangeTransactionFee(`gas price exceeded. gas_upper_bound=${gasUpperBound} but it is ${maxFeePerGas}`);
        }
        
        return {
          maxFeePerGas: parseGwei(`${maxFeePerGas}`),
          maxPriorityFeePerGas: parseGwei(`${maxPriorityFeePerGas}`)
        };
      } catch (e) {
        if (!DEV_ENV && e instanceof Response) {
          console.error(`Failed to get gas info from metaswap status_code=${e.status}`);
        }
        throw new FailedToGetGasPrice(`Failed to get gas info from api: ${e.message}`);
      }
    }
    
    async getGasFromRpc(priority, gasUpperBound) {
      let gasPrice = null;
      let foundGasBelowUpperBound = false;
      
      for (const provider of this.providers) {
        const rpcUrl = provider.transport.url;
        try {
          gasPrice = await provider.getGasPrice();
          const gasPriceGwei = Number(formatGwei(gasPrice));
          this.loggerParams({ gas_price: gasPriceGwei.toString(), gas_price_provider: rpcUrl });
          
          if (gasPriceGwei <= gasUpperBound) {
            foundGasBelowUpperBound = true;
            break;
          }
        } catch (e) {
          console.error(`Failed to get gas price from ${rpcUrl}, e=${e.message}`);
        }
      }
      
      if (gasPrice === null) {
        throw new FailedToGetGasPrice("None of RCPs could provide gas price!");
      }
      
      if (!foundGasBelowUpperBound) {
        throw new OutOfRangeTransactionFee(
          `gas price exceeded. gas_upper_bound=${gasUpperBound} but it is ${formatGwei(gasPrice)}`
        );
      }
      
      const multiplier = this.multipliers[priority] || 1;
      return {
        gasPrice: BigInt(Math.floor(Number(gasPrice) * multiplier))
      };
    }
    
    async getFixedValue(priority, gasUpperBound) {
      const gas = CHAIN_ID_TO_GAS[this.chainId] || FIXED_VALUE_GAS;
      
      if (gas > gasUpperBound) {
        throw new OutOfRangeTransactionFee(`gas price exceeded. gas_upper_bound=${gasUpperBound} but it is ${gas}`);
      }
      
      const multiplier = this.multipliers[priority] || 1;
      return {
        gasPrice: parseGwei(`${gas * multiplier}`)
      };
    }
    
    async customGasEstimation() {
      throw new Error('Custom gas estimation not implemented');
    }
    
    async getGasPrice(gasUpperBound, priority, method = null) {
      // Try the specified method if provided
      if (method !== null) {
        const methodFn = this.gasEstimationMethods[method];
        if (methodFn) {
          try {
            return await methodFn(priority, gasUpperBound);
          } catch (e) {
            if (!(e instanceof FailedToGetGasPrice)) {
              throw e;
            }
          }
        }
      }
      
      // If chainId is in special list, use RPC directly
      if (DEV_ENV || GAS_FROM_RPC_CHAIN_IDS.includes(this.chainId)) {
        return await this.getGasFromRpc(priority, gasUpperBound);
      }
      
      // Try all methods in priority order
      let gasParams = {};
      for (const methodKey of this.methodSortedPriority) {
        try {
          gasParams = await this.gasEstimationMethods[methodKey](priority, gasUpperBound);
          break;
        } catch (e) {
          console.warn(`Method ${methodKey} failed to provide gas with this error: ${e.message}`);
          continue;
        }
      }
      
      if (Object.keys(gasParams).length === 0) {
        throw new FailedToGetGasPrice("All of methods failed to estimate gas");
      }
      
      return gasParams;
    }
  }
  
  // TxTrace for debugging transaction failures
  class TxTrace {
    constructor(txHash) {
      this.txHash = txHash;
      this.response = null;
      this._json = null;
    }
    
    async trace(rpcUrl = null) {
      try {
        const targetRpc = rpcUrl || 'https://fantom.publicnode.com';
        const data = {
          id: 1,
          jsonrpc: "2.0",
          method: "debug_traceTransaction",
          params: [
            this.txHash,
            { tracer: 'callTracer', disableStack: false, disableStorage: true }
          ]
        };
        
        const response = await fetch(targetRpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });
        
        if (response.ok) {
          this.response = response;
          this._json = await response.json();
        } else {
          console.error(`TxTrace failed with status: ${response.status}`);
        }
      } catch (e) {
        console.error(`Exception in debug_traceTransaction: ${e.message}`);
      }
      
      return this;
    }
    
    ok() {
      return Boolean(this.response);
    }
    
    text() {
      return this.response ? this.response.text() : '';
    }
    
    json() {
      return this._json || {};
    }
    
    result() {
      return new TxTraceResult(this.json().result || {});
    }
  }
  
  class TxTraceResult {
    constructor(result) {
      this._json = result;
    }
    
    get(key, defaultValue = null) {
      return this._json[key] !== undefined ? this._json[key] : defaultValue;
    }
    
    error() {
      return this.get('error');
    }
    
    revertReason() {
      return this.get('revertReason');
    }
    
    from() {
      return this.get('from');
    }
    
    to() {
      return this.get('to');
    }
    
    gasUsed() {
      return this.get('gasUsed');
    }
    
    calls() {
      return (this.get('calls') || []).map(call => new TxTraceResult(call));
    }
    
    allRevertReasons() {
      const revertReasons = [];
      
      const currentReason = this.get('revertReason');
      if (currentReason) {
        revertReasons.push(currentReason);
      }
      
      const calls = this.calls();
      if (calls.length > 0) {
        for (const childCall of calls) {
          revertReasons.push(...childCall.allRevertReasons());
        }
      }
      
      return revertReasons;
    }
    
    shortError() {
      return `error=${this.error()} revertReason=${this.revertReason()}`;
    }
    
    longError() {
      const revertReasons = this.allRevertReasons();
      return `error=${this.error()} revert-reasons=${JSON.stringify(revertReasons)}`;
    }
    
    firstUsableError() {
      const errors = [this.error(), ...this.allRevertReasons()].filter(Boolean);
      for (const error of errors) {
        if (error && !error.includes('execution reverted') && !error.includes('MultiAccount: Error occurred')) {
          return error;
        }
      }
      return '';
    }
  }
  
  // Main MultiChainRPC class
  export class MultiChainRPC {
    constructor(chainConfigs = {}, options = {}) {
      // Chain configs is an object where keys are chain IDs and values are config objects
      // Example: { 1: { contractAddress, contractAbi, rpcUrls }, 137: {...} }
      this.chainConfigs = {};
  
      // Add configs for each chain
      for (const [chainIdStr, config] of Object.entries(chainConfigs)) {
        const chainId = Number(chainIdStr);
        this.chainConfigs[chainId] = {
          contractAddress: config.contractAddress,
          contractAbi: config.contractAbi,
          rpcUrls: config.rpcUrls instanceof NestedDict ? config.rpcUrls : new NestedDict(config.rpcUrls)
        };
      }
      
      // Options with defaults
      this.viewPolicy = options.viewPolicy || ViewPolicy.MostUpdated;
      this.gasLimit = options.gasLimit || DEFAULT_GAS_LIMIT;
      this.gasUpperBound = options.gasUpperBound || DEFAULT_GAS_UPPER_BOUND;
      this.enableGasEstimation = options.enableGasEstimation || false;
      this.isProofAuthority = options.isProofAuthority || false;
      this.logLevel = options.logLevel || 'warn';
      this.apm = options.apm || null;
      this.eventBatchSize = options.eventBatchSize || DEFAULT_EVENT_BATCH_SIZE;
      
      // Initialize state
      this.accounts = {}; // chainId -> { address, privateKey }
      this.providers = new NestedDict(); // chainId -> { view: {}, transaction: {} }
      this.wallets = new NestedDict(); // chainId -> { transaction: {} }
      this.contracts = new NestedDict(); // chainId -> { view: {}, transaction: {} }
      this.multiCalls = new NestedDict(); // chainId -> { view: {}, transaction: {} }
      this.gasEstimations = {}; // chainId -> GasEstimation
      this.chainFunctions = {}; // chainId -> functions map
      this.eventFilters = {}; // chainId -> { filterId: { filter, provider } }
      
      // Initialize logger
      this.setupLogger();
    }
    
    setupLogger() {
      const logLevels = {
        'debug': 0,
        'info': 1,
        'warn': 2,
        'error': 3
      };
      
      const currentLevel = logLevels[this.logLevel] || 2;
      
      this.logger = {
        debug: (...args) => { if (currentLevel <= 0) console.debug(...args); },
        info: (...args) => { if (currentLevel <= 1) console.info(...args); },
        warn: (...args) => { if (currentLevel <= 2) console.warn(...args); },
        error: (...args) => { if (currentLevel <= 3) console.error(...args); }
      };
    }
    
    _logger_params(params) {
      if (this.apm) {
        this.apm.span_label(params);
      } else {
        this.logger.info(`params=${JSON.stringify(params)}`);
      }
    }
    
    // Initialize viem clients and contracts for all chains
    async setup() {
      for (const [chainIdStr, config] of Object.entries(this.chainConfigs)) {
        const chainId = Number(chainIdStr);
        
        // Set up providers for this chain
        this.providers.set([chainId], 
          await this.createProvidersFromRpc(config.rpcUrls, chainId)
        );
        
        // Create wallet clients for this chain
        const wallets = new NestedDict({ transaction: {} });
        
        for (const bracket in this.providers.get([chainId, 'transaction'], {})) {
          const providers = this.providers.get([chainId, 'transaction', bracket], []);
          const chainWallets = [];
          
          for (const provider of providers) {
            const walletClient = createWalletClient({
              transport: http(provider.transport.url),
              chain: { id: chainId }
            });
            chainWallets.push(walletClient);
          }
          
          wallets.set(['transaction', bracket], chainWallets);
        }
        
        this.wallets.set([chainId], wallets.data);
        
        // Create gas estimation for this chain
        if (this.providers.get([chainId, 'transaction'])) {
          const providersList = reduceListOfList(Object.values(this.providers.get([chainId, 'transaction'], {})));
          this.gasEstimations[chainId] = new GasEstimation(chainId, providersList);
        }
        
        // Create contract instances for this chain
        const contracts = new NestedDict({ view: {}, transaction: {} });
        let isRpcProvided = false;
        
        for (const type in this.providers.get([chainId], {})) {
          for (const bracket in this.providers.get([chainId, type], {})) {
            const providers = this.providers.get([chainId, type, bracket], []);
            const chainContracts = [];
            
            for (const provider of providers) {
              try {
                const contract = getContract({
                  address: config.contractAddress,
                  abi: config.contractAbi,
                  publicClient: provider
                });
                
                chainContracts.push(contract);
                isRpcProvided = true;
              } catch (e) {
                this.logger.warn(`[Chain ${chainId}] Failed to create contract for RPC: ${e.message}`);
              }
            }
            
            contracts.set([type, bracket], chainContracts);
          }
        }
        
        this.contracts.set([chainId], contracts.data);
        
        if (!isRpcProvided) {
          this.logger.error(`[Chain ${chainId}] No available RPC provided`);
          continue;
        }
        
        // Create function wrappers for this chain
        const functions = {};
        
        for (const item of config.contractAbi) {
          if (item.type !== 'function') continue;
          
          const funcName = item.name;
          let functionType = ContractFunctionType.Transaction;
          
          if (['view', 'pure'].includes(item.stateMutability)) {
            functionType = ContractFunctionType.View;
          }
          
          if (!functions[funcName]) {
            functions[funcName] = this.createContractFunction(funcName, item, functionType, chainId);
          }
        }
        
        this.chainFunctions[chainId] = functions;
        this.eventFilters[chainId] = {};
      }
      
      return this;
    }
    
    // Get functions for a specific chain
    getChainFunctions(chainId) {
      if (!this.chainFunctions[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      return this.chainFunctions[chainId];
    }
    
    // Creates providers for each RPC URL
    async createProvidersFromRpc(rpcUrls, chainId) {
      const providers = new NestedDict({ transaction: {}, view: {} });
      
      for (const type in rpcUrls.data) {
        for (const bracket in rpcUrls.get(type, {})) {
          const rpcs = rpcUrls.get([type, bracket]);
          
          if (rpcs.length > MAX_RPC_IN_EACH_BRACKET) {
            throw new MaximumRPCInEachBracketReached();
          }
          
          const validRpcs = [];
          
          for (const rpc of rpcs) {
            try {
              const provider = createPublicClient({
                transport: http(rpc),
                chain: { id: chainId }
              });
              
              // Check connection
              try {
                await provider.getChainId();
                validRpcs.push(provider);
              } catch (e) {
                this.logger.warn(`[Chain ${chainId}] This rpc(${rpc}) doesn't work: ${e.message}`);
              }
            } catch (e) {
              this.logger.warn(`[Chain ${chainId}] Failed to create client for RPC ${rpc}: ${e.message}`);
            }
          }
          
          if (validRpcs.length === 0) {
            throw new AtLastProvideOneValidRPCInEachBracket();
          }
          
          providers.set([type, bracket], validRpcs);
        }
      }
      
      return providers.data;
    }
    
    // Set the account info for a specific chain
    setChainAccount(chainId, address, privateKey) {
      if (!this.chainConfigs[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      
      this.accounts[chainId] = { address, privateKey };
    }
    
    // Set account for all configured chains
    setAccount(address, privateKey) {
      for (const chainId in this.chainConfigs) {
        this.setChainAccount(Number(chainId), address, privateKey);
      }
    }
    
    // Create a contract function wrapper for a specific chain
    createContractFunction(name, abi, type, chainId) {
      const self = this;
      
      // Return a function that captures the args
      const func = function(...args) {
        // Return a callable object with a call method
        return {
          name,
          type,
          args,
          chainId,
          call: async function(options = {}) {
            // If chainId is provided in options, use that instead
            const targetChainId = options.chainId || chainId;
            
            if (!self.chainConfigs[targetChainId]) {
              throw new ChainIdNotConfigured(targetChainId);
            }
            
            const account = self.accounts[targetChainId] || {};
            const address = options.address || account.address;
            const privateKey = options.privateKey || account.privateKey;
            const gasLimit = options.gasLimit || self.gasLimit;
            const gasUpperBound = options.gasUpperBound || self.gasUpperBound;
            const waitForReceipt = options.waitForReceipt !== undefined ? options.waitForReceipt : 90;
            const priority = options.priority || TxPriority.Low;
            const gasEstimationMethod = options.gasEstimationMethod;
            const blockIdentifier = options.blockIdentifier || 'latest';
            const enableGasEstimation = options.enableGasEstimation !== undefined ? 
              options.enableGasEstimation : self.enableGasEstimation;
            
            // Include chainId in debug logs
            self.logger.info(`[Chain ${targetChainId}] Calling ${type} function: ${name}`);
            
            if (!self.providers.get([targetChainId, type])) {
              throw new DontHaveThisRpcType(`[Chain ${targetChainId}] Doesn't have ${type} RPCs`);
            }
            
            if (type === ContractFunctionType.View) {
              return await self.callViewFunction(name, blockIdentifier, args, targetChainId);
            } else if (type === ContractFunctionType.Transaction) {
              return await self.callTxFunction({
                funcName: name,
                funcArgs: args,
                address,
                privateKey,
                gasLimit,
                gasUpperBound,
                waitForReceipt,
                priority,
                gasEstimationMethod,
                enableGasEstimation,
                chainId: targetChainId
              });
            }
          }
        };
      };
      
      return func;
    }
    
    // Execute a view function call on a specific chain
    async callViewFunction(funcName, blockIdentifier = 'latest', args = [], chainId) {
      if (!this.providers.get([chainId, ContractFunctionType.View])) {
        throw new DontHaveThisRpcType(`[Chain ${chainId}] Doesn't have view RPCs`);
      }
      
      const findMaxBlockResult = (results) => {
        if (results.length === 0) return null;
        
        let maxBlockNumber = results[0].blockNumber;
        let maxIndex = 0;
        
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.blockNumber === 'latest') continue;
          if (maxBlockNumber === 'latest' || BigInt(result.blockNumber) > BigInt(maxBlockNumber)) {
            maxBlockNumber = result.blockNumber;
            maxIndex = i;
          }
        }
        
        return results[maxIndex].result;
      };
      
      let lastError = null;
      
      // Try each bracket of RPC providers
      for (const bracket in this.contracts.get([chainId, ContractFunctionType.View], {})) {
        const contracts = this.contracts.get([chainId, ContractFunctionType.View, bracket], []);
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        const executionPromises = [];
        
        // Create a promise for each contract
        for (let i = 0; i < contracts.length; i++) {
          const provider = providers[i];
          const promise = provider.readContract({
            address: this.chainConfigs[chainId].contractAddress,
            abi: this.chainConfigs[chainId].contractAbi,
            functionName: funcName,
            args,
            blockTag: blockIdentifier
          })
          .then(async result => ({ 
            blockNumber: blockIdentifier === 'latest' ? 
              await provider.getBlockNumber() : 
              blockIdentifier, 
            result 
          }))
          .catch(error => ({ error }));
          
          executionPromises.push(promise);
        }
        
        try {
          let results;
          
          if (this.viewPolicy === ViewPolicy.MostUpdated) {
            // Wait for all to complete
            results = await Promise.all(executionPromises);
          } else if (this.viewPolicy === ViewPolicy.FirstSuccess) {
            // Return the first successful result
            const firstSuccess = await Promise.any(executionPromises).catch(e => ({ error: e }));
            results = [firstSuccess];
          } else {
            throw new NotValidViewPolicy();
          }
          
          // Filter out errors
          const successResults = results.filter(r => !r.error);
          
          if (successResults.length === 0) {
            const errors = results.map(r => r.error).filter(Boolean);
            lastError = new FailedOnAllRPCs(`[Chain ${chainId}] All RPCs failed: ${errors[0]?.message || 'Unknown error'}`);
            continue;
          }
          
          // For MostUpdated, return the result with the highest block number
          if (this.viewPolicy === ViewPolicy.MostUpdated && blockIdentifier === 'latest') {
            return findMaxBlockResult(successResults);
          }
          
          // Otherwise just return the first successful result
          return successResults[0].result;
        } catch (e) {
          lastError = e;
          this.logger.info(`[Chain ${chainId}] Can't call view function from this list of rpc(${bracket}): ${e.message}`);
        }
      }
      
      throw lastError || new ViewCallFailed(`[Chain ${chainId}] All providers failed for view call`);
    }
    
    // Get the nonce for an address on a specific chain
    async getNonce(address, chainId) {
      const providersForNonce = this.providers.get([chainId, ContractFunctionType.View]) || 
                                this.providers.get([chainId, ContractFunctionType.Transaction]);
      let lastError = null;
      
      for (const bracket in providersForNonce) {
        const executionPromises = [];
        
        for (const provider of providersForNonce[bracket]) {
          executionPromises.push(provider.getTransactionCount({ address }));
        }
        
        try {
          const results = await Promise.all(executionPromises.map(p => p.catch(e => ({ error: e }))));
          const successResults = results.filter(r => !r.error && r !== undefined && r !== null);
          
          if (successResults.length > 0) {
            // Return the highest nonce to be safe
            return Math.max(...successResults.map(r => Number(r)));
          }
        } catch (e) {
          lastError = e;
          this.logger.warn(`[Chain ${chainId}] Failed to get nonce: ${e.message}`);
        }
      }
      
      throw lastError || new Web3InterfaceException(`[Chain ${chainId}] All of RPCs raise exception.`);
    }
    
    // Get transaction parameters including gas estimation for a specific chain
    async getTxParams(nonce, address, gasLimit, gasUpperBound, priority, gasEstimationMethod, chainId) {
      const gasEstimation = this.gasEstimations[chainId];
      if (!gasEstimation) {
        throw new Error(`[Chain ${chainId}] No gas estimation available`);
      }
      
      const gasParams = await gasEstimation.getGasPrice(gasUpperBound, priority, gasEstimationMethod);
      
      const txParams = {
        account: { address },
        nonce,
        gas: gasLimit || this.gasLimit,
        chainId,
        ...gasParams
      };
      
      return txParams;
    }
    
    // Build and prepare a transaction for a specific chain
    async buildTransaction(contract, provider, walletClient, funcName, funcArgs, signerAccount, txParams, enableGasEstimation, chainId) {
      try {
        // Prepare transaction parameters
        const callParams = {
          address: this.chainConfigs[chainId].contractAddress,
          abi: this.chainConfigs[chainId].contractAbi,
          functionName: funcName,
          args: funcArgs,
          account: signerAccount,
          ...txParams
        };
        
        // Estimate gas if needed
        if (enableGasEstimation) {
          const estimateGas = await provider.estimateContractGas(callParams);
          this.logger.info(`[Chain ${chainId}] Gas estimation: ${estimateGas} gas needed`);
          callParams.gas = estimateGas;
        }
        
        // Simulate transaction to check if it will work
        try {
          await provider.simulateContract(callParams);
        } catch (e) {
          this.logger.error(`[Chain ${chainId}] Transaction simulation failed: ${e.message}`);
          throw e;
        }
        
        return callParams;
      } catch (e) {
        this.logger.error(`[Chain ${chainId}] Exception in build transaction: ${e.message}`);
        throw e;
      }
    }
    
    // Execute a transaction on a specific chain
    async sendTransaction(walletClient, provider, txParams, chainId) {
      const rpcUrl = provider.transport.url;
      try {
        // Send the transaction
        const hash = await walletClient.writeContract(txParams);
        const rpcLabelPrefix = rpcUrl.split("//")[1].replace(/\./g, "__").replace(/\//g, "__");
        
        this._logger_params({ [`${rpcLabelPrefix}_post_send_time`]: getUnixTime() });
        this._logger_params({ tx_send_time: getUnixTime(), chain_id: chainId });
        
        this.logger.info(`[Chain ${chainId}] Transaction sent: ${hash}`);
        return { walletClient, provider, hash };
      } catch (e) {
        // Handle known errors
        const errorMsg = e.message.toLowerCase();
        this.logger.error(`[Chain ${chainId}] RPC(${rpcUrl}) value error: ${e.message}`);
        
        const isKnownError = [
          'nonce too low',
          'already known',
          'transaction underpriced',
          'account suspended',
          'exceeds the configured cap',
          'transaction would cause overdraft'
        ].some(errText => errorMsg.includes(errText));
        
        if (!isKnownError) {
          this.logger.error(`[Chain ${chainId}] _send_transaction_exception`);
        }
        
        if (
          errorMsg.includes('nonce too low') ||
          errorMsg.includes('already known') ||
          errorMsg.includes('connection') ||
          errorMsg.includes('timeout')
        ) {
          throw new TransactionValueError(e.message);
        }
        
        throw e;
      }
    }
    
    // Handle transaction trace for debugging failures on a specific chain
    handleTxTrace(trace, funcName, funcArgs, funcKwargs, chainId) {
      // This can be extended to handle specific error cases
      if (trace.ok()) {
        this.logger.error(`[Chain ${chainId}] TraceTransaction(${funcName}): ${trace.result().longError()}`);
        
        if (this.apm) {
          this.apm.capture_message({
            message: `[Chain ${chainId}] tr failed (${funcName}, ${trace.result().firstUsableError()}): %s`,
            params: [trace.text()]
          });
        }
      }
    }
    
    // Wait for and get transaction receipt on a specific chain
    async waitForTransactionReceipt(provider, txHash, timeout, funcName, funcArgs, funcKwargs, chainId) {
      let connectionErrorCount = 0;
      let txErrorCount = 0;
      const rpcUrl = provider.transport.url;
      
      while (true) {
        try {
          this._logger_params({ received_provider: rpcUrl, chain_id: chainId });
          
          const txReceipt = await provider.getTransactionReceipt({ hash: txHash });
          
          if (txReceipt) {
            if (txReceipt.status === 'success') {
              return { provider, txReceipt };
            } else {
              // Transaction failed
              const trace = new TxTrace(txHash);
              await trace.trace(rpcUrl);
              this.handleTxTrace(trace, funcName, funcArgs, funcKwargs, chainId);
              throw new TransactionFailedStatus(txHash, funcName, funcArgs, funcKwargs, trace);
            }
          }
          
          // If receipt not found, wait and try again
          await delay(2000);
        } catch (e) {
          if (e instanceof TransactionFailedStatus) {
            throw e;
          }
          
          if (e.message.includes('connection') && connectionErrorCount < 5) {
            connectionErrorCount++;
            await delay(5000);
          } else if ((e.message.includes('timeout') || e.message.includes('not found')) && txErrorCount < 1) {
            txErrorCount++;
            timeout *= 2;
          } else {
            throw e;
          }
        }
      }
    }
    
    // Execute batch tasks with first-success policy
    async executeBatchTasks(executionList, exceptionHandler = null, finalException = null, chainId) {
      const cancelEvent = {
        isSet: false,
        result: null,
        setResult(value) { this.result = value; },
        set() { this.isSet = true; }
      };
      
      const lock = {
        locked: false,
        async acquire() {
          while (this.locked) {
            await delay(10);
          }
          this.locked = true;
        },
        release() { this.locked = false; }
      };
      
      // Create a wrapper that executes a task and sets the result on success
      async function execTask(task, cancelEvent, lock) {
        try {
          const res = await task;
          await lock.acquire();
          cancelEvent.setResult(res);
          lock.release();
          cancelEvent.set();
          return res;
        } catch (e) {
          return Promise.reject(e);
        }
      }
      
      // Start all tasks
      const promises = executionList.map(task => 
        execTask(task, cancelEvent, lock)
          .catch(e => ({ error: e }))
      );
      
      // Race promises with timeout
      const results = await Promise.allSettled(promises.map(p => 
        Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), REQUEST_TIMEOUT))
        ])
      ));
      
      // If cancelEvent was set, return the saved result
      if (cancelEvent.isSet) {
        return cancelEvent.result;
      }
      
      // Check for successful results
      const fulfilledResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(v => v && !v.error);
        
      if (fulfilledResults.length > 0) {
        return fulfilledResults[0];
      }
      
      // Check for errors that should be handled
      let exception = null;
      let terminalException = null;
      
      for (const result of results) {
        if (result.status === 'rejected' || (result.value && result.value.error)) {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          
          if (exceptionHandler && exceptionHandler.some(handler => error instanceof handler)) {
            exception = error;
          } else {
            terminalException = error;
            break;
          }
        }
      }
      
      if (terminalException) {
        throw terminalException;
      }
      
      if (exception) {
        throw exception;
      }
      
      throw finalException || new Error(`[Chain ${chainId}] All tasks failed`);
    }
    
    // Execute a transaction with the contract on a specific chain
    async callTx(options) {
      const {
        funcName,
        funcArgs,
        funcKwargs = {},
        privateKey,
        waitForReceipt,
        providers,
        wallets,
        contracts,
        txParams,
        enableGasEstimation,
        chainId
      } = options;
      
      // Create account object from private key for viem
      const account = { address: txParams.account.address, privateKey };
      
      // Build and sign the transaction
      const signedTransaction = await this.buildTransaction(
        contracts[0], providers[0], wallets[0], funcName, funcArgs, account, txParams, enableGasEstimation, chainId
      );
      
      const txHash = signedTransaction.hash;
      this._logger_params({ tx_hash: txHash, chain_id: chainId });
      
      // Send the transaction to all providers and get the first successful one
      const sendPromises = wallets.map((wallet, i) => 
        this.sendTransaction(wallet, providers[i], signedTransaction, chainId)
      );
      
      try {
        const result = await this.executeBatchTasks(
          sendPromises,
          [TransactionValueError, Error, TypeError],
          FailedOnAllRPCs,
          chainId
        );
        
        const { provider, hash } = result;
        
        this.logger.info(`[Chain ${chainId}] Success tx: provider = ${provider.transport.url}, tx = ${hash}`);
        this._logger_params({ sent_provider: provider.transport.url, chain_id: chainId });
        
        if (!waitForReceipt) {
          return hash;
        }
        
        // Wait for receipt from all providers and get the first successful one
        const receiptPromises = providers.map(p => 
          this.waitForTransactionReceipt(p, hash, waitForReceipt, funcName, funcArgs, funcKwargs, chainId)
        );
        
        const { txReceipt } = await this.executeBatchTasks(
          receiptPromises,
          [Error, TypeError],
          null,
          chainId
        );
        
        return txReceipt;
      } catch (e) {
        if (e instanceof TransactionFailedStatus || e instanceof TransactionValueError) {
          throw e;
        }
        throw new FailedOnAllRPCs(`[Chain ${chainId}] Failed to send transaction: ${e.message}`);
      }
    }
    
    // Check if view RPCs are available for a specific chain
    checkForView(chainId) {
      if (!this.providers.get([chainId, ContractFunctionType.View])) {
        throw new DontHaveThisRpcType(`[Chain ${chainId}] Doesn't have view RPCs`);
      }
    }
    
    // Main transaction function call for a specific chain
    async callTxFunction(options) {
      const {
        funcName,
        funcArgs,
        funcKwargs = {},
        address,
        privateKey,
        gasLimit,
        gasUpperBound,
        waitForReceipt,
        priority,
        gasEstimationMethod,
        enableGasEstimation,
        chainId
      } = options;
      
      if (!address || !privateKey) {
        throw new Error(`[Chain ${chainId}] Address and private key are required for transactions`);
      }
      
      // Get nonce
      const nonce = await this.getNonce(address, chainId);
      
      // Get transaction parameters with gas estimation
      const txParams = await this.getTxParams(
        nonce, address, gasLimit, gasUpperBound, priority, gasEstimationMethod, chainId
      );
      
      const _enableGasEstimation = enableGasEstimation !== undefined ? enableGasEstimation : this.enableGasEstimation;
      
      // Try with each bracket of providers
      for (const bracket in this.providers.get([chainId, ContractFunctionType.Transaction], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.Transaction, bracket], []);
        const wallets = this.wallets.get([chainId, 'transaction', bracket], []);
        const contracts = this.contracts.get([chainId, ContractFunctionType.Transaction, bracket], []);
        
        try {
          return await this.callTx({
            funcName,
            funcArgs,
            funcKwargs,
            privateKey,
            waitForReceipt,
            providers,
            wallets,
            contracts,
            txParams,
            enableGasEstimation: _enableGasEstimation,
            chainId
          });
        } catch (e) {
          if (e instanceof TransactionFailedStatus || e instanceof TransactionValueError) {
            throw e;
          }
          this.logger.warn(`[Chain ${chainId}] Transaction failed with providers in bracket ${bracket}: ${e.message}`);
        }
      }
      
      throw new Web3InterfaceException(`[Chain ${chainId}] All of RPCs raise exception.`);
    }
    
    // Get a transaction receipt from a specific chain
    async getTransactionReceipt(txHash, chainId) {
      this.checkForView(chainId);
      
      const exceptions = ["HttpError", "ConnectionError", "ReadTimeout", "Error", "TimeExhausted", "TransactionNotFound"];
      
      let lastException = null;
      for (const bracket in this.providers.get([chainId, ContractFunctionType.View], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        const executionTxList = providers.map(p => 
          p.waitForTransactionReceipt({ hash: txHash })
        );
        
        try {
          return await this.executeBatchTasks(
            executionTxList,
            exceptions.map(e => ({ name: e })),
            TransactionFailedStatus,
            chainId
          );
        } catch (e) {
          if (e instanceof TransactionFailedStatus) {
            throw e;
          }
          lastException = e;
        }
      }
      
      throw lastException;
    }
    
    // Get block data from a specific chain
    async getBlock(blockIdentifier, fullTransactions = false, chainId) {
      this.checkForView(chainId);
      
      const exceptions = ["HttpError", "ConnectionError", "ReadTimeout", "Error", "TimeExhausted", "BlockNotFound"];
      
      let lastException = null;
      for (const bracket in this.providers.get([chainId, ContractFunctionType.View], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        const executionTxParamsList = providers.map(p => {
          if (typeof blockIdentifier === 'string' && !blockIdentifier.startsWith('0x')) {
            // It's a named block like 'latest'
            return p.getBlock({
              blockTag: blockIdentifier,
              includeTransactions: fullTransactions
            });
          } else {
            // It's a block number or hash
            const isHash = typeof blockIdentifier === 'string' && blockIdentifier.startsWith('0x');
            const blockParam = isHash ? 
              { blockHash: blockIdentifier, includeTransactions: fullTransactions } : 
              { blockNumber: BigInt(blockIdentifier), includeTransactions: fullTransactions };
              
            return p.getBlock(blockParam);
          }
        });
        
        try {
          return await this.executeBatchTasks(
            executionTxParamsList,
            exceptions.map(e => ({ name: e })),
            GetBlockFailed,
            chainId
          );
        } catch (e) {
          if (e instanceof GetBlockFailed) {
            throw e;
          }
          lastException = e;
        }
      }
      
      throw lastException;
    }
    
    // Get current block number from a specific chain
    async getBlockNumber(chainId) {
      this.checkForView(chainId);
      
      const exceptions = ["HttpError", "ConnectionError", "ReadTimeout", "Error", "TimeExhausted"];
      
      let lastException = null;
      for (const bracket in this.providers.get([chainId, ContractFunctionType.View], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        const executionTxParamsList = providers.map(p => p.getBlockNumber());
        
        try {
          return await this.executeBatchTasks(
            executionTxParamsList,
            exceptions.map(e => ({ name: e })),
            GetBlockFailed,
            chainId
          );
        } catch (e) {
          if (e instanceof GetBlockFailed) {
            throw e;
          }
          lastException = e;
        }
      }
      
      throw lastException;
    }
    
    // NEW METHODS FOR EVENT HANDLING
    
    /**
     * Get past events from a specific contract on a chain
     * @param {Object} options Event retrieval options
     * @param {number} options.chainId Chain ID to get events from
     * @param {string} options.eventName Name of the event to fetch
     * @param {Object} [options.filter] Event filter parameters (indexed params)
     * @param {number|string} [options.fromBlock='0'] Start block number or 'latest'
     * @param {number|string} [options.toBlock='latest'] End block number or 'latest'
     * @param {boolean} [options.paginate=false] Whether to paginate results
     * @param {number} [options.pageSize] Number of blocks to query in each request when paginating
     * @returns {Promise<Array>} Array of decoded event logs
     */
    async getEvents({
      chainId,
      eventName,
      filter = {},
      fromBlock = 0,
      toBlock = 'latest',
      paginate = false,
      pageSize = this.eventBatchSize
    }) {
      if (!this.chainConfigs[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      
      this.checkForView(chainId);
      
      const contractAddress = this.chainConfigs[chainId].contractAddress;
      const contractAbi = this.chainConfigs[chainId].contractAbi;
      
      // Find the event ABI
      const eventAbi = contractAbi.find(item => 
        item.type === 'event' && item.name === eventName
      );
      
      if (!eventAbi) {
        throw new Error(`[Chain ${chainId}] Event '${eventName}' not found in contract ABI`);
      }
      
      // Try each bracket of RPC providers until one succeeds
      for (const bracket in this.providers.get([chainId, ContractFunctionType.View], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        
        for (const provider of providers) {
          try {
            if (!paginate) {
              // Simple case: get all events in one call
              const logs = await provider.getLogs({
                address: contractAddress,
                event: parseAbiItem(JSON.stringify(eventAbi)),
                args: filter,
                fromBlock,
                toBlock
              });
              
              return logs;
            } else {
              // Paginated case: break query into smaller chunks
              let allLogs = [];
              let currentFromBlock = BigInt(fromBlock === 'latest' ? 
                await provider.getBlockNumber() : 
                fromBlock);
              const finalToBlock = BigInt(toBlock === 'latest' ? 
                await provider.getBlockNumber() : 
                toBlock);
              
              while (currentFromBlock <= finalToBlock) {
                const currentToBlock = currentFromBlock + BigInt(pageSize) < finalToBlock ? 
                  currentFromBlock + BigInt(pageSize) : 
                  finalToBlock;
                
                this.logger.info(`[Chain ${chainId}] Getting events from blocks ${currentFromBlock} to ${currentToBlock}`);
                
                const logs = await provider.getLogs({
                  address: contractAddress,
                  event: parseAbiItem(JSON.stringify(eventAbi)),
                  args: filter,
                  fromBlock: currentFromBlock,
                  toBlock: currentToBlock
                });
                
                allLogs = [...allLogs, ...logs];
                currentFromBlock = currentToBlock + 1n;
              }
              
              return allLogs;
            }
          } catch (error) {
            this.logger.warn(`[Chain ${chainId}] Failed to get events from provider: ${error.message}`);
            // Try the next provider
            continue;
          }
        }
      }
      
      throw new EventRetrievalFailed(chainId, eventName, new Error('All providers failed'));
    }
    
    /**
     * Create an event filter for subscribing to events
     * @param {Object} options Filter options
     * @param {number} options.chainId Chain ID to create filter on
     * @param {string} options.eventName Name of the event to filter
     * @param {Object} [options.filter] Event filter parameters (indexed params)
     * @param {number|string} [options.fromBlock='latest'] Start block number or 'latest'
     * @returns {Promise<string>} Filter ID for use with getFilterChanges
     */
    async createEventFilter({
      chainId,
      eventName,
      filter = {},
      fromBlock = 'latest'
    }) {
      if (!this.chainConfigs[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      
      this.checkForView(chainId);
      
      const contractAddress = this.chainConfigs[chainId].contractAddress;
      const contractAbi = this.chainConfigs[chainId].contractAbi;
      
      // Find the event ABI
      const eventAbi = contractAbi.find(item => 
        item.type === 'event' && item.name === eventName
      );
      
      if (!eventAbi) {
        throw new Error(`[Chain ${chainId}] Event '${eventName}' not found in contract ABI`);
      }
      
      // Try each bracket of RPC providers until one succeeds
      for (const bracket in this.providers.get([chainId, ContractFunctionType.View], {})) {
        const providers = this.providers.get([chainId, ContractFunctionType.View, bracket], []);
        
        for (const provider of providers) {
          try {
            // Create a filter on the provider
            const filterId = await provider.createContractEventFilter({
              address: contractAddress,
              event: parseAbiItem(JSON.stringify(eventAbi)),
              args: filter,
              fromBlock
            });
            
            // Generate a unique ID for this filter and save it
            const uniqueFilterId = `${chainId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            this.eventFilters[chainId][uniqueFilterId] = {
              filter: filterId,
              provider,
              eventName
            };
            
            return uniqueFilterId;
          } catch (error) {
            this.logger.warn(`[Chain ${chainId}] Failed to create event filter: ${error.message}`);
            // Try the next provider
            continue;
          }
        }
      }
      
      throw new EventRetrievalFailed(chainId, eventName, new Error('Failed to create filter on any provider'));
    }
    
    /**
     * Get new events from a filter since the last poll
     * @param {Object} options Options for getting filter changes
     * @param {number} options.chainId Chain ID of the filter
     * @param {string} options.filterId Filter ID returned from createEventFilter
     * @returns {Promise<Array>} Array of new event logs
     */
    async getFilterChanges({
      chainId,
      filterId
    }) {
      if (!this.chainConfigs[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      
      if (!this.eventFilters[chainId] || !this.eventFilters[chainId][filterId]) {
        throw new Error(`[Chain ${chainId}] Filter ID '${filterId}' not found`);
      }
      
      const { filter, provider, eventName } = this.eventFilters[chainId][filterId];
      
      try {
        const changes = await provider.getFilterChanges({ filter });
        return changes;
      } catch (error) {
        throw new EventRetrievalFailed(chainId, eventName, error);
      }
    }
    
    /**
     * Uninstall an event filter to free up resources
     * @param {Object} options Options for removing a filter
     * @param {number} options.chainId Chain ID of the filter
     * @param {string} options.filterId Filter ID to uninstall
     * @returns {Promise<boolean>} True if successful
     */
    async uninstallFilter({
      chainId,
      filterId
    }) {
      if (!this.chainConfigs[chainId]) {
        throw new ChainIdNotConfigured(chainId);
      }
      
      if (!this.eventFilters[chainId] || !this.eventFilters[chainId][filterId]) {
        throw new Error(`[Chain ${chainId}] Filter ID '${filterId}' not found`);
      }
      
      const { filter, provider } = this.eventFilters[chainId][filterId];
      
      try {
        const success = await provider.uninstallFilter({ filter });
        if (success) {
          delete this.eventFilters[chainId][filterId];
        }
        return success;
      } catch (error) {
        this.logger.warn(`[Chain ${chainId}] Failed to uninstall filter: ${error.message}`);
        // Even if the RPC call fails, we'll remove it from our tracking
        delete this.eventFilters[chainId][filterId];
        return false;
      }
    }
    
    /**
     * Watch for events in real-time and call a callback when new events are detected
     * This is a convenience method that handles polling in the background
     * @param {Object} options Watch options
     * @param {number} options.chainId Chain ID to watch events on
     * @param {string} options.eventName Name of the event to watch
     * @param {Object} [options.filter] Event filter parameters
     * @param {number} [options.pollingInterval=5000] How often to poll for new events (ms)
     * @param {Function} callback Function to call when new events are detected
     * @returns {Object} Control object with stop() method to stop watching
     */
    watchEvents({
      chainId,
      eventName,
      filter = {},
      pollingInterval = 5000
    }, callback) {
      let isWatching = true;
      let filterId = null;
      
      // Start the watcher
      const watch = async () => {
        try {
          // Create a filter
          filterId = await this.createEventFilter({
            chainId,
            eventName,
            filter,
            fromBlock: 'latest'
          });
          
          // Poll for changes
          while (isWatching) {
            try {
              const events = await this.getFilterChanges({
                chainId,
                filterId
              });
              
              if (events && events.length > 0) {
                callback(null, events);
              }
            } catch (error) {
              if (isWatching) {
                callback(error);
              }
            }
            
            // Wait for the next poll
            await delay(pollingInterval);
          }
        } catch (error) {
          if (isWatching) {
            callback(error);
          }
        }
      };
      
      // Start watching
      watch();
      
      // Return control object
      return {
        async stop() {
          isWatching = false;
          if (filterId) {
            await this.uninstallFilter({
              chainId,
              filterId
            }).catch(e => {
              this.logger.warn(`[Chain ${chainId}] Error uninstalling filter: ${e.message}`);
            });
          }
        }
      };
    }
  }
  
  export {
    ViewPolicy,
    TxPriority,
    GasEstimationMethod,
    ContractFunctionType
  };