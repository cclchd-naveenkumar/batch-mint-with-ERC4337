import { Storage } from '@google-cloud/storage';
const storage = new Storage();


const GCP_BUCKET_NAME_VARIFIABLE_DOCS = "verifiable-docs";
const GCP_IRCTC_BUCKET_NAME_IMAGE = "nfttrace-cert-image-live";


export const getImage = async(filePath: string) => {
    try{
        const metadata =  await storage.bucket(GCP_IRCTC_BUCKET_NAME_IMAGE).file(filePath).download();
        return metadata[0];
    } catch (e) {
        console.log('Get Image Details From Bucket Error', e);
    }
}

export const uploadVerifiableFile = async(file,filename) => {
    try{
      const FileWriteStream = storage.bucket(GCP_BUCKET_NAME_VARIFIABLE_DOCS).file(filename).createWriteStream();
      FileWriteStream.write(Buffer.from(file));
      FileWriteStream.end();
      
      const response = {
        message: `${filename} uploaded to ${GCP_BUCKET_NAME_VARIFIABLE_DOCS}`,
        success: true,
        fileLink:`https://storage.cloud.google.com/${GCP_BUCKET_NAME_VARIFIABLE_DOCS}/${filename}`
      };
      console.log("File uploaded to GCP:", response.fileLink);
      
      return response;
    }
    catch(err){
        // logger.error("ERROR : Error while uploading verifiable data");
        // await slackWebHook("ERROR : Error while uploading verifiable data");
    }
}