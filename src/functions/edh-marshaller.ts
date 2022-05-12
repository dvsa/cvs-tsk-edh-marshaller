import {
  DynamoDBRecord,
  DynamoDBStreamEvent,
  Handler,
} from 'aws-lambda';
import { AWSError, SQS } from 'aws-sdk';
import { SQSService } from '../services/sqs';
import { PromiseResult } from 'aws-sdk/lib/request';
import { SendMessageResult } from 'aws-sdk/clients/sqs';
import { debugOnlyLog, getTargetQueueFromSourceARN } from '../utils/utils';

/**
 * λ function to process a DynamoDB stream of test results into a queue for certificate generation.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const edhMarshaller: Handler = async (event: DynamoDBStreamEvent): Promise<void | Array<PromiseResult<SendMessageResult, AWSError>>> => {
  if (!event) {
    console.error('ERROR: event is not defined.');
    return;
  }
  const records: DynamoDBRecord[] = event.Records;
  if (!records || !records.length) {
    console.error('ERROR: No Records in event: ', event);
    return;
  }

  debugOnlyLog('Records: ', records);

  // Instantiate the Simple Queue Service
  const sqService: SQSService = new SQSService(new SQS());
  const sendMessagePromises: Promise<PromiseResult<SendMessageResult, AWSError>>[] = [];

  for (const record of records) {
    debugOnlyLog('Record: ', record);

    if (record.eventSourceARN) {
      debugOnlyLog('New image: ', record.dynamodb?.NewImage);
      const targetQueue = getTargetQueueFromSourceARN(record.eventSourceARN);
  
      debugOnlyLog('Target Queue', targetQueue);
      sendMessagePromises.push(sqService.sendMessage(JSON.stringify(record), targetQueue));
    }
  }

  return Promise.all(sendMessagePromises).catch((error: AWSError) => {
    console.error(error);
    console.log('records', records);
    if (error.code !== 'InvalidParameterValue') {
      throw error;
    }
  });
};

export { edhMarshaller };
