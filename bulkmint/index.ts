import {
  http,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  parseAbi
} from "viem"

import crypto from "node:crypto"
import util from "node:util"
import mysql from "mysql"
import web3 from "web3"
import { abi } from "./helpers/abi/factory.json"

import { createSmartAccountClient } from "@biconomy/account"
import { ethers } from "ethers"
import { privateKeyToAccount } from "viem/accounts"
import { polygonAmoy } from "viem/chains"
import { PaymasterMode } from "../src"
import { getImage, uploadVerifiableFile } from "./helpers/gcp"
import { uploadFile } from "./helpers/ipfs"
// import {connectContract} from './helpers/connectContract';

const GCP_NFTTRACE_BUCKET_NAME_IMAGE = "nfttrace-cert-image-live"
const FACTORY_CONTRACT_ADDRESS = "0x915BB62190F3FB84400408FBc7F6938477db30F2"
const privateKey = process.env.PRIVATE_KEY || ""
let wallet: any

const RPC_URL = process.env.RPC_URL
  ? process.env.RPC_URL
  : "https://polygon-mumbai.infura.io/v3/7b2"
const web3provider = new web3(new web3.providers.HttpProvider(RPC_URL))

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})

pool.query = util.promisify(pool.query)

const queryIsProcessedNftAsc = async () => {
  try {
    const results = await pool.query(
      "SELECT * FROM bulk_cert_requests WHERE is_processed = 0 ORDER BY id ASC LIMIT 50"
    )
    return results
  } catch (error) {
    console.log("Error: ", error)
    throw error
  }
}

// const addTxtoPool = async(to,encodedData) => {
//     try {
//         const results = await pool.query(
//             'INSERT INTO tx_pool (to_address,encoded_data) VALUES (?,?)',
//             [to,encodedData]
//         );
//         return results;
//     } catch (error) {
//         console.log("Error: ", error);
//         throw error;
//     }
// }

const updateNftStatus = async (token_id) => {
  try {
    const results = await pool.query(
      "UPDATE bulk_cert_requests SET is_processed = 1 WHERE token_id = ?",
      [token_id]
    )
    return results
  } catch (error) {
    console.log("Error: ", error)
    throw error
  }
}

const fetchContractAddress = async (categoryid) => {
  try {
    const results = await pool.query(
      "SELECT contract FROM nft_document_categories WHERE id = ?",
      [categoryid]
    )
    return results[0].contract
  } catch (error) {
    console.log("Error: ", error)
    throw error
  }
}

export const connectContract = async (contractAddress: string) => {
  try {
    const contract = new ethers.Contract(contractAddress, abi)
    return contract
  } catch (e) {
    console.log("Error while connecting contract", e)
  }
}

const ProcessNFTMetadata = async (data) => {
  try {
    const contractAddressSet = new Set<string>()
    const params = {}

    const mintTxs: { to: string; data: string }[] = []
    for (let i = 0; i < data.length; i++) {
      console.log("processing NFT of id: ", data[i].token_id)
      console.log(
        "Fetching NFT Image from GCP for token_id: ",
        data[i].token_id
      )

      const Image_Path = `${data[i].job_id}/${data[i].token_id}.jpg`
      const Image = (await getImage(Image_Path)) || ""
      const ImageBuffer = Buffer.from(Image)
      const file = ImageBuffer.toString("base64")
      const ImageIPFS = await uploadFile(file)
      const formatedImageIPFS = ImageIPFS?.replace(/"/g, "")
      console.log("Image Uploaded to IPFS: ", ImageIPFS)
      const name = data[i].name
      const description = data[i].description
      const category = data[i].category
      const recipient = data[i].recipient
      const imageURI = `https://ipfs.io/ipfs/${formatedImageIPFS}`
      const tokenId = data[i].token_id
      const metaData = JSON.parse(data[i].metadata)
      const keys = Object.keys(metaData)

      const attributes: any = []
      for (let j = 0; j < keys.length; j++) {
        const trait_type = keys[j]
        const value = JSON.stringify(metaData[trait_type]).replace(/"/g, "")
        const trait = JSON.stringify({ trait_type: trait_type, value: value })
        attributes.push(JSON.parse(trait))
      }

      const odHashForImage = crypto
        .createHash("sha3-256")
        .update(Image)
        .digest("hex")
      const messageHash = (await web3provider.utils.sha3(odHashForImage)) || ""
      const signature = (
        await web3provider.eth.accounts.sign(messageHash, `0x${privateKey}`)
      ).signature
      const signtrait = JSON.stringify({
        trait_type: "signature",
        value: signature
      })
      const odhashtrait = JSON.stringify({
        trait_type: "ODHash",
        value: odHashForImage
      })
      attributes.push(JSON.parse(signtrait))
      attributes.push(JSON.parse(odhashtrait))
      const uploadJson = {
        name,
        description,
        category,
        image: imageURI,
        attributes: attributes
      }

      const metadatahash = await uploadFile(JSON.stringify(uploadJson))
      console.log("Metadata Uploaded to IPFS: ", metadatahash)
      const formatedmetaDataHash = metadatahash?.replace(/"/g, "");
      // const metadatahash = 'metaDataHash';

      const contract_address = await fetchContractAddress(data[i].category_id)
      const factoryContract = await connectContract(FACTORY_CONTRACT_ADDRESS)

      const encodedData = factoryContract?.interface.encodeFunctionData(
        "issueCertificate",
        [contract_address, recipient, tokenId, formatedmetaDataHash]
      )

      if (!contractAddressSet.has(contract_address)) {
        contractAddressSet.add(contract_address)
        params[contract_address] = {
          address: [],
          tokenId: [],
          tokenURI: [],
          odHash: [],
          imageBuffer: [],
          imageName: [],
          attributes: [],
          mintTx: []
        }
      }

      params[contract_address].address.push(recipient)
      params[contract_address].tokenId.push(tokenId)
      params[contract_address].tokenURI.push(formatedmetaDataHash)
      params[contract_address].odHash.push(odHashForImage)
      params[contract_address].imageBuffer.push(Buffer.from(Image))
      params[contract_address].imageName.push(`${tokenId}.jpg`)
      params[contract_address].attributes.push(attributes)
      params[contract_address].mintTx.push({
        to: FACTORY_CONTRACT_ADDRESS,
        data: encodedData
      })
    }

    console.log("Embedding Metadata for NFTs:::::::::::::::: ")
    console.log("Contract Address Set: ", contractAddressSet)

    for (const nftContract of contractAddressSet) {
      console.log("Embedding Metadata for Contract: ", nftContract)

      const { transactionHash } = await processTxs(params[nftContract].mintTx)

      for (let i = 0; i < params[nftContract].tokenId.length; i++) {
        console.log(
          "Embedding Metadata for tokenId: ",
          params[nftContract].tokenId[i]
        )

        const embedData = {
          tokenId: params[nftContract].tokenId[i],
          issuer: wallet,
          recipient: params[nftContract].address[i],
          txHash: transactionHash,
          ODHash: params[nftContract].odHash[i],
          metaDataHash: params[nftContract].tokenURI[i],
          blockchain: "polygon"
        }

        const embededMetaData = `<--NFTRACE_KEY_START-->${Buffer.from(
          JSON.stringify(embedData)
        )}<--NFTRACE_KEY_END-->`
        const modifiedFile = Buffer.concat([
          params[nftContract].imageBuffer[i],
          Buffer.from(embededMetaData)
        ])
        await uploadVerifiableFile(
          modifiedFile,
          params[nftContract].imageName[i]
        )
      }
      console.log("Embedding Metadata for NFTs Completed:::::::::::::::: ")
      console.log("Updating NFT Status in DB:::::::::::::::: ")
      for (let i = 0; i < params[nftContract].tokenId.length; i++) {
        await updateNftStatus(params[nftContract].tokenId[i])
      }
      console.log(":::::::::::::::: NFT Status Updated in DB :::::::::::::::: ")
    }
  } catch (error) {
    console.log("Error: ", error)
    throw error
  }
}

const processTxs = async (mintTxs) => {
  const paymasterUrl =
    "https://paymaster.biconomy.io/api/v1/80002/qX9uXTHNm.dc1e610e-daee-46a8-acb2-7b6438fd8428"
  const bundlerUrl =
    "https://bundler.biconomy.io/api/v2/80002/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44"

  const account = privateKeyToAccount(`0x${privateKey}`)
  const signer = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http()
  })
  const smartAccount = await createSmartAccountClient({
    signer,
    bundlerUrl,
    paymasterUrl
  }) // Retrieve bundler and pymaster urls from dashboard
  const getAddress = await smartAccount.getAddress()

  console.log("SmartAccount :", getAddress)

  const buildUseropDto = {
    paymasterServiceData: {
      mode: PaymasterMode.ERC20
    }
  }
  console.log("========= Sending Trasaction to blockchain ======")

  const { wait } = await smartAccount.sendTransaction(mintTxs, buildUseropDto)

  const {
    receipt: { transactionHash },
    userOpHash,
    success
  } = await wait()
  console.log("Transaction hash :", transactionHash)

  return { transactionHash, userOpHash, success }
}

async function main() {
  try {
    const getTxs = await queryIsProcessedNftAsc()
    if (getTxs.length > 0) {
      await ProcessNFTMetadata(getTxs)
    } else {
      console.log("No NFTs to process....")
    }
  } catch (error) {
    console.log("Error: ", error)
  }
}

main()
