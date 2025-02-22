"use client"

import * as React from "react"
import { polygonAmoy } from "viem/chains"
import { type Hex, createPublicClient, encodeFunctionData, formatUnits } from "viem"
import {
  type P256Credential,
  type SmartAccount,
  type WebAuthnAccount,
  createBundlerClient,
  toWebAuthnAccount,
} from "viem/account-abstraction"
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from "@circle-fin/modular-wallets-core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"

const clientKey = process.env.NEXT_PUBLIC_CLIENT_KEY as string
const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL as string
const USDC_CONTRACT_ADDRESS = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
]
const USDC_DECIMALS = 6

export function EnhancedUSDCTransfer() {
  const [account, setAccount] = React.useState<SmartAccount>()
  const [credential, setCredential] = React.useState<P256Credential>()
  const [username, setUsername] = React.useState<string>()
  const [hash, setHash] = React.useState<Hex>()
  const [userOpHash, setUserOpHash] = React.useState<Hex>()
  const [balance, setBalance] = React.useState<string>("0")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const { toast } = useToast()

  const passkeyTransport = React.useMemo(() => toPasskeyTransport(clientUrl, clientKey), [])
  const modularTransport = React.useMemo(() => toModularTransport(`${clientUrl}/polygonAmoy`, clientKey), [])


  const client = React.useMemo(
    () =>
      createPublicClient({
        chain: polygonAmoy,
        transport: modularTransport,
      }),
    [modularTransport],
  )

  const bundlerClient = React.useMemo(
    () =>
      createBundlerClient({
        chain: polygonAmoy,
        transport: modularTransport,
      }),
    [modularTransport],
  )

  React.useEffect(() => {
    const storedCredential = localStorage.getItem("credential")
    const storedUsername = localStorage.getItem("username")
    if (storedCredential) {
      setCredential(JSON.parse(storedCredential))
    }
    if (storedUsername) {
      setUsername(storedUsername)
    }
  }, [])

  React.useEffect(() => {
    if (!credential || !username) return

    toCircleSmartAccount({
      client,
      owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      name: username,
    }).then(setAccount)
  }, [credential, username, client])

  React.useEffect(() => {
    if (account) {
      fetchBalance()
    }
  }, [account])

  const fetchBalance = React.useCallback(async () => {
    if (!account) return
    try {
      const balance = await client.readContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [account.address],
      })
      setBalance(formatUnits(balance as bigint, USDC_DECIMALS))
    } catch (error) {
      console.error("Error fetching balance:", error)
      toast({
        title: "Error",
        description: "Failed to fetch balance. Please try again.",
        variant: "destructive",
      })
    }
  }, [account, client, toast])

  const register = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      const newUsername = formData.get("username") as string
      try {
        const newCredential = await toWebAuthnCredential({
          transport: passkeyTransport,
          mode: WebAuthnMode.Register,
          username: newUsername,
        })
        localStorage.setItem("credential", JSON.stringify(newCredential))
        localStorage.setItem("username", newUsername)
        setCredential(newCredential)
        setUsername(newUsername)
      } catch (error) {
        console.error("Error registering:", error)
        toast({
          title: "Registration Failed",
          description: "An error occurred during registration. Please try again.",
          variant: "destructive",
        })
      }
    },
    [passkeyTransport, toast],
  )

  const login = React.useCallback(async () => {
    try {
      const newCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      })
      localStorage.setItem("credential", JSON.stringify(newCredential))
      setCredential(newCredential)
    } catch (error) {
      console.error("Error logging in:", error)
      toast({
        title: "Login Failed",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      })
    }
  }, [passkeyTransport, toast])

  const sendUserOperation = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!account) return

      const formData = new FormData(event.currentTarget)
      const to = formData.get("to") as `0x${string}`;
      const value = formData.get("value") as string

      try {
        const data = encodeFunctionData({
          abi: USDC_ABI,
          functionName: "transfer",
          args: [to, BigInt(Number.parseFloat(value) * 10 ** USDC_DECIMALS)],
        })

        const userOpHash = await bundlerClient.sendUserOperation({
          account,
          calls: [
            {
              to: USDC_CONTRACT_ADDRESS,
              data,
            },
          ],
          paymaster: true,
        })
        setUserOpHash(userOpHash)

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
        setHash(receipt.transactionHash)
        setIsDialogOpen(true)
        fetchBalance()
      } catch (error) {
        console.error("Error sending transaction:", error)
        toast({
          title: "Transaction Failed",
          description: "An error occurred while sending the transaction. Please try again.",
          variant: "destructive",
        })
      }
    },
    [account, bundlerClient, fetchBalance, toast],
  )

  if (!credential)
    return (
      <Card className="w-[450px] rounded-3xl shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold">Register or Login</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Create a new account or login to an existing one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={register} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base">
                Username
              </Label>
              <Input id="username" name="username" placeholder="Enter your username" className="h-12" />
            </div>
            <div className="flex gap-4">
              <Button type="submit" className="flex-1 h-12 text-base font-medium bg-black hover:bg-black/90 rounded-xl">
                Register
              </Button>
              <Button onClick={login} variant="outline" className="flex-1 h-12 text-base font-medium rounded-xl">
                Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )

  if (!account) return <p>Loading...</p>

  return (
    <Card className="w-[450px] rounded-3xl shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-semibold">Circle Modular Wallet</CardTitle>
        <CardDescription className="text-lg text-muted-foreground">Authenticate wallet creation and sending of USDC via Passkey</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Account Address</Label>
            <p className="font-mono text-sm break-all bg-muted/50 p-3 rounded-lg">{account.address}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base">USDC Balance</Label>
            <p className="text-2xl font-semibold">{balance} USDC</p>
          </div>
        </div>
        <form onSubmit={sendUserOperation} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to" className="text-base">
                Recipient Address
              </Label>
              <Input id="to" name="to" placeholder="0x..." className="font-mono h-12 text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value" className="text-base">
                Amount (USDC)
              </Label>
              <Input
                id="value"
                name="value"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0.00"
                className="h-12 text-lg"
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 text-base font-medium bg-black hover:bg-black/90 rounded-xl">
            Send USDC
          </Button>
        </form>
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Transaction Sent</DialogTitle>
            <DialogDescription className="text-base">Your USDC transfer has been processed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right font-medium">User Op Hash</Label>
              <Input value={userOpHash} readOnly className="col-span-3 font-mono text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right font-medium">Tx Hash</Label>
              <Input value={hash} readOnly className="col-span-3 font-mono text-sm" />
            </div>
          </div>
          <Button
            onClick={() => setIsDialogOpen(false)}
            className="w-full h-12 text-base font-medium bg-black hover:bg-black/90 rounded-xl"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
