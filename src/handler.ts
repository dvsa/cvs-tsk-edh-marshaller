import { config as AWSConfig } from 'aws-sdk';
import { edhMarshaller } from './functions/edhMarshaller';

const isOffline: boolean = (!process.env.BRANCH || process.env.BRANCH === 'local');

if (isOffline) {
  AWSConfig.credentials = {
    accessKeyId: 'offline',
    secretAccessKey: 'offline',
  };
}

export { edhMarshaller as handler };
