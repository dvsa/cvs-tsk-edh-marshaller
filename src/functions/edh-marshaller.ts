import {
  DynamoDBRecord,
  DynamoDBStreamEvent,
  Handler,
} from 'aws-lambda';
import { AWSError, SQS } from 'aws-sdk';
import { SQSService } from '../services/sqs';
import { PromiseResult } from 'aws-sdk/lib/request';
import { SendMessageResult } from 'aws-sdk/clients/sqs';
import { debugOnlyLog, getTargetQueueFromSourceARN, getTechRecordEnvVar } from '../utils/utilities';
import { transformTechRecord } from '../utils/transform-tech-record';

/**
 * λ function to process a DynamoDB stream and forward it to an appropriate SQS queue.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const edhMarshaller: Handler = async (event: DynamoDBStreamEvent): Promise<void | Array<PromiseResult<SendMessageResult, AWSError>>> => {
  const processFlatTechRecords: boolean = getTechRecordEnvVar();

  if (!event) {
    console.error('ERROR: event is not defined.');
    return undefined;
  }
  const records: DynamoDBRecord[] = event.Records;
  if (!records || !records.length) {
    console.error('ERROR: No Records in event: ', event);
    return undefined;
  }

  debugOnlyLog('Records: ', records);

  // Instantiate the Simple Queue Service
  const sqsService: SQSService = new SQSService(new SQS());
  const sendMessagePromises: Promise<PromiseResult<SendMessageResult, AWSError>>[] = [];

  for (const record of records) {
    debugOnlyLog('Record: ', record);

    if (record.eventSourceARN) {
      debugOnlyLog('New image: ', record.dynamodb?.NewImage);
      const targetQueue = getTargetQueueFromSourceARN(record.eventSourceARN);

      // PROCESS_FLAT_TECH_RECORDS toggles whether flat-tech-records or technical-records record stream events populate the NOP
      if (record.eventSourceARN.includes('flat-tech-records')) {
        if (!processFlatTechRecords) {
          debugOnlyLog('Ignoring flat-tech-record stream event');
          continue;
        }
        transformTechRecord(record);
        debugOnlyLog('Succesfully transformed flat-tech-record stream event');
      }

      if (record.eventSourceARN.includes('technical-records') && processFlatTechRecords) {
        debugOnlyLog('Ignoring technical-record stream event');
        continue;
      }
  
      debugOnlyLog('Target Queue', targetQueue);
      sendMessagePromises.push(sqsService.sendMessage(JSON.stringify(record), targetQueue));
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
