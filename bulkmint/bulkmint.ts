import { createSmartAccountClient } from "@biconomy/account"
import {
  http,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  parseAbi
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { polygonAmoy } from "viem/chains"
import { PaymasterMode } from "../src"

const mysql = require("mysql")
const util = require("node:util")
const timeout = 5

const pool = mysql.createPool({
  connectionLimit: 10,
  host: "34.131.50.76",
  user: "root",
  password: "zZx63EkvIgA7",
  database: "nftrace_dev"
})

//it would be convenient to use promisified version of 'query' methods
pool.query = util.promisify(pool.query)

const getTxs = await pool.query(
  "SELECT * FROM tx_pool WHERE is_processed = 0 LIMIT 10"
)
console.log("getTxs", getTxs)

const mintTxs: { to: string; data: string }[] = []
for (const tx of getTxs) {
  const mintTx = {
    to: tx.to_address,
    data: tx.encoded_data
  }
  mintTxs.push(mintTx)
}

console.log("Mint Txs:", mintTxs)

// const Minttx1 = {
//     to: '0xe8aAB05ED7ef54C629574919AE9811983Dc592e3',
//     data: data
//   };

//   const preferredToken = "0x747A4168DB14F57871fa8cda8B5455D8C2a8e90a"; // USDT
//   const nftAddress = "0x1758f42Af7026fBbB559Dc60EcE0De3ef81f665e";

const paymasterUrl =
  "https://paymaster.biconomy.io/api/v1/80002/qX9uXTHNm.dc1e610e-daee-46a8-acb2-7b6438fd8428"
const bundlerUrl =
  "https://bundler.biconomy.io/api/v2/80002/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44"

const privateKey =
  "0xa02feb494b86ce884ed2b00b98bc3d1ebf5a19a78cbe48ed9f8de06474894bc8"
const account = privateKeyToAccount(privateKey)

const TokenContractAddress = "0x3339d47871cCbCece4dCBF6612f99E955CB84c12"

const signer = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
})
const getChainId = await signer.getChainId()
console.log("getChainId", getChainId)

const smartAccount = await createSmartAccountClient({
  signer,
  bundlerUrl,
  paymasterUrl
}) // Retrieve bundler and pymaster urls from dashboard
const getAddress = await smartAccount.getAddress()
console.log("SmartAccount", getAddress)

const getAddresses = await signer.getAddresses()
const addr = getAddresses[0]

// const getAllModules = await smartAccount.getAllModules()
// console.log("getAllModules", getAllModules);

//   const tokenBalance = await smartAccount.getBalances([preferredToken]);
//   console.log("Token Balance:", tokenBalance);

//   const Minttx1 = {
//     to: '0xe8aAB05ED7ef54C629574919AE9811983Dc592e3',
//     data: encodeFunctionData({
//       abi: parseAbi(["function mint(address to,uint256 amount) external"]),
//       functionName: "mint",
//       args: ['0x511c31bC3b3ef3155A690b92bA725F53c9A98573',BigInt(1000000000000000000000)],
//     }),
//   };

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http()
})
//  const balance = await client.getBalance({
//    address: getAddress,
//  })

// console.log("balance", balance);

// // const getSupportedTokens = await smartAccount.getSupportedTokens();
// // console.log("getSupportedTokens",getSupportedTokens);

const buildUseropDto = {
  paymasterServiceData: {
    mode: PaymasterMode.ERC20
    // preferredToken,
  }
}

const { wait } = await smartAccount.sendTransaction(
  mintTxs /* Mint twice */,
  buildUseropDto
)

const {
  receipt: { transactionHash },
  userOpHash,
  success
} = await wait()

console.log("transactionHash", transactionHash)
console.log("userOpHash", userOpHash)
console.log("success", success)
