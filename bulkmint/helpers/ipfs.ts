import axios from "axios"
import { create } from "ipfs-http-client"

// const PROJECT_ID = '2MzXNxeCq2tIsubEa48lHX76EFM';
// const PROJECT_SECRET = 'ddb45fd87ba4d4e9f37dfbb4f189fd31';

// console.log("ProjectId",PROJECT_ID);
// console.log("ProjectSecrate",PROJECT_SECRET);

// const client = create({
//   host: "ipfs.infura.io",
//   port: 5001,
//   protocol: "https",
//   headers: {
//     authorization: `Basic ${Buffer.from(`${PROJECT_ID}:${PROJECT_SECRET}`).toString("base64")}`,
//   },
// });

// console.log('IPFS client created', client);

export const uploadFile = async (file: any) => {
  try {
    const data = JSON.stringify({
      file: file
    })

    const config = {
      method: "post",
      maxBodyLength: Number.POSITIVE_INFINITY,
      url: "https://nftrace-blockchain-dev.chaincodeconsulting.com/certificates/add-file-to-ipfs",
      headers: {
        "Content-Type": "application/json"
      },
      data: data
    }
    const result = await axios.request(config)
    return JSON.stringify(result.data.Hash)
  } catch (e) {
    console.log("Error while uploading file to IPFS", e)
    console.error(e) // Log the error message
  }
}

uploadFile("hello")

// export const addFile = async (file) =>{
// try{
// let data = JSON.stringify({
//   "file": file
// });

// let config = {
//   method: 'post',
//   maxBodyLength: Infinity,
//   url: 'http://127.0.0.1:3001/certificates/addFile',
//   headers: {
//     'Content-Type': 'application/json'
//   },
//   data : data
// };

// const res = await axios.request(config);
// console.log("Result",res);
// return res;
//   } catch(error){
//     console.log("Error : Error in adding file",error);
//   }
// }
