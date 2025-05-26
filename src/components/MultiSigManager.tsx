import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MultiSigManagerProps {
  tokenId: Id<"memeCoins">;
  isOwner: boolean;
}

export function MultiSigManager({ tokenId, isOwner }: MultiSigManagerProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [owners, setOwners] = useState<string[]>(["", ""]);
  const [requiredConfirmations, setRequiredConfirmations] = useState(2);
  
  const multiSigWallet = useQuery(api.security.multiSig.getMultiSigWallet, { tokenId });
  const pendingTransactions = useQuery(api.security.multiSig.getPendingTransactions, {
    multiSigAddress: multiSigWallet?.address || "",
  });
  
  const deployMultiSig = useAction(api.security.multiSig.deployMultiSigWallet);
  const confirmTransaction = useAction(api.security.multiSig.confirmMultiSigTransaction);
  
  const handleDeploy = async () => {
    const validOwners = owners.filter(o => o.trim().length === 42 && o.startsWith("0x"));
    
    if (validOwners.length < 2) {
      toast.error("At least 2 valid owner addresses required");
      return;
    }
    
    if (requiredConfirmations < 1 || requiredConfirmations > validOwners.length) {
      toast.error("Invalid number of required confirmations");
      return;
    }
    
    setIsDeploying(true);
    try {
      const result = await deployMultiSig({
        tokenId,
        owners: validOwners,
        requiredConfirmations,
        blockchain: "ethereum", // TODO: Get from token deployment
      });
      
      toast.success("Multi-sig wallet deployed successfully!");
    } catch (error) {
      console.error("Failed to deploy multi-sig:", error);
      toast.error("Failed to deploy multi-sig wallet");
    } finally {
      setIsDeploying(false);
    }
  };
  
  const handleConfirm = async (txIndex: number) => {
    if (!multiSigWallet) return;
    
    try {
      const result = await confirmTransaction({
        multiSigAddress: multiSigWallet.address,
        txIndex,
        blockchain: "ethereum", // TODO: Get from deployment
        confirmer: "owner1", // TODO: Get current user's owner ID
      });
      
      if (result.executed) {
        toast.success("Transaction executed successfully!");
      } else {
        toast.success("Transaction confirmed");
      }
    } catch (error) {
      console.error("Failed to confirm transaction:", error);
      toast.error("Failed to confirm transaction");
    }
  };
  
  const addOwnerField = () => {
    setOwners([...owners, ""]);
  };
  
  const updateOwner = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };
  
  const removeOwner = (index: number) => {
    setOwners(owners.filter((_, i) => i !== index));
  };
  
  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multi-Signature Security
          </CardTitle>
          <CardDescription>
            Only token owners can manage multi-sig settings
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  if (multiSigWallet) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Multi-Sig Wallet Active
            </CardTitle>
            <CardDescription>
              Your token is secured with multi-signature protection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Wallet Address</Label>
                <div className="font-mono text-sm bg-gray-50 p-2 rounded">
                  {multiSigWallet.address}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Owners</Label>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{multiSigWallet.owners.length}</span>
                  </div>
                </div>
                
                <div>
                  <Label>Required Confirmations</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>{multiSigWallet.requiredConfirmations}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Owner Addresses</Label>
                <div className="space-y-1 mt-2">
                  {multiSigWallet.owners.map((owner, index) => (
                    <div key={index} className="font-mono text-xs bg-gray-50 p-1 rounded">
                      {owner}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {pendingTransactions && pendingTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Transactions</CardTitle>
              <CardDescription>
                Transactions awaiting confirmation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingTransactions.map((tx) => (
                  <div key={tx._id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-gray-600">To: {tx.to}</p>
                        <p className="text-sm text-gray-600">Value: {tx.value} ETH</p>
                      </div>
                      <Badge variant={tx.confirmations.length >= multiSigWallet.requiredConfirmations ? "default" : "secondary"}>
                        {tx.confirmations.length}/{multiSigWallet.requiredConfirmations} confirmations
                      </Badge>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(tx.txIndex)}
                        disabled={tx.confirmations.some(c => c.confirmer === "owner1")} // TODO: Check current user
                      >
                        Confirm
                      </Button>
                      
                      <div className="flex -space-x-2">
                        {tx.confirmations.map((conf, index) => (
                          <div
                            key={index}
                            className="h-6 w-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center"
                            title={`Confirmed by ${conf.confirmer}`}
                          >
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Enable Multi-Signature Security
        </CardTitle>
        <CardDescription>
          Protect your token with multi-signature wallet requiring multiple confirmations for critical operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Owner Addresses</Label>
              <p className="text-sm text-gray-600 mb-2">
                Add Ethereum addresses that will control the multi-sig wallet
              </p>
              {owners.map((owner, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="0x..."
                    value={owner}
                    onChange={(e) => updateOwner(index, e.target.value)}
                    className="font-mono text-sm"
                  />
                  {owners.length > 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOwner(index)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOwnerField}
                className="mt-2"
              >
                Add Owner
              </Button>
            </div>
            
            <div>
              <Label>Required Confirmations</Label>
              <p className="text-sm text-gray-600 mb-2">
                Number of confirmations needed to execute transactions
              </p>
              <Input
                type="number"
                min={1}
                max={owners.length}
                value={requiredConfirmations}
                onChange={(e) => setRequiredConfirmations(parseInt(e.target.value))}
                className="w-32"
              />
            </div>
          </div>
          
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full"
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying Multi-Sig...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Deploy Multi-Sig Wallet
              </>
            )}
          </Button>
          
          <div className="bg-blue-50 rounded-lg p-4 text-sm">
            <h4 className="font-medium text-blue-900 mb-1">Security Benefits</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Requires multiple approvals for token operations</li>
              <li>• Prevents single point of failure</li>
              <li>• Transparent on-chain governance</li>
              <li>• Protects against compromised keys</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}