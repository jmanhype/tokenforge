import { ethers } from "ethers";
import { toast } from "sonner";

// Token ABI for approval
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

declare global {
  interface Window {
    ethereum?: any;
  }
}

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask or another Web3 wallet");
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      const address = await this.signer.getAddress();
      
      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          window.location.reload();
        }
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });

      return address;
    } catch (error: any) {
      throw new Error(error.message || "Failed to connect wallet");
    }
  }

  disconnect() {
    this.provider = null;
    this.signer = null;
  }

  async getNetwork(): Promise<{ chainId: number; name: string }> {
    if (!this.provider) throw new Error("Wallet not connected");
    
    const network = await this.provider.getNetwork();
    return {
      chainId: Number(network.chainId),
      name: network.name,
    };
  }

  async switchNetwork(chainId: number) {
    if (!window.ethereum) throw new Error("No wallet detected");

    const chainIdHex = `0x${chainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error.code === 4902) {
        const chainConfig = this.getChainConfig(chainId);
        if (!chainConfig) throw new Error("Unsupported chain");

        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [chainConfig],
          });
        } catch (addError) {
          throw new Error("Failed to add network");
        }
      } else {
        throw error;
      }
    }
  }

  private getChainConfig(chainId: number) {
    const configs: Record<number, any> = {
      11155111: { // Sepolia
        chainId: "0xaa36a7",
        chainName: "Sepolia Testnet",
        nativeCurrency: {
          name: "SepoliaETH",
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: ["https://sepolia.infura.io/v3/"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"],
      },
      97: { // BSC Testnet
        chainId: "0x61",
        chainName: "BSC Testnet",
        nativeCurrency: {
          name: "BNB",
          symbol: "BNB",
          decimals: 18,
        },
        rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
        blockExplorerUrls: ["https://testnet.bscscan.com"],
      },
    };

    return configs[chainId];
  }

  async getBalance(address?: string): Promise<string> {
    if (!this.provider || !this.signer) throw new Error("Wallet not connected");
    
    const addr = address || await this.signer.getAddress();
    const balance = await this.provider.getBalance(addr);
    
    return ethers.formatEther(balance);
  }

  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    if (!this.provider || !this.signer) throw new Error("Wallet not connected");
    
    const addr = userAddress || await this.signer.getAddress();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance = await token.balanceOf(addr);
    
    return ethers.formatEther(balance);
  }

  async executeTransaction(txData: {
    to: string;
    data: string;
    value: string;
  }): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected");

    try {
      const tx = await this.signer.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: ethers.parseEther(txData.value),
      });

      toast.info("Transaction submitted. Waiting for confirmation...");
      
      const receipt = await tx.wait();
      
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return receipt.hash;
    } catch (error: any) {
      if (error.code === "ACTION_REJECTED") {
        throw new Error("Transaction rejected by user");
      }
      throw new Error(error.message || "Transaction failed");
    }
  }

  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected");

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    
    // Check current allowance
    const currentAllowance = await token.allowance(
      await this.signer.getAddress(),
      spenderAddress
    );

    const requiredAmount = ethers.parseEther(amount);

    if (currentAllowance >= requiredAmount) {
      return "Already approved";
    }

    const tx = await token.approve(spenderAddress, requiredAmount);
    toast.info("Approval transaction submitted...");
    
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      throw new Error("Approval failed");
    }

    return receipt.hash;
  }

  async waitForTransaction(txHash: string): Promise<ethers.TransactionReceipt> {
    if (!this.provider) throw new Error("Wallet not connected");
    
    const receipt = await this.provider.waitForTransaction(txHash);
    
    if (!receipt || receipt.status === 0) {
      throw new Error("Transaction failed");
    }
    
    return receipt;
  }

  isConnected(): boolean {
    return this.signer !== null;
  }

  async getAddress(): Promise<string | null> {
    if (!this.signer) return null;
    return await this.signer.getAddress();
  }
}

// Singleton instance
export const web3Service = new Web3Service();