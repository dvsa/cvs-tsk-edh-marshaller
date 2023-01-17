import {
  DynamoDBRecord,
  DynamoDBStreamEvent,
  Handler,
} from 'aws-lambda';
import { SQS } from 'aws-sdk';
import AWSXray from 'aws-xray-sdk';
import { SendMessageRequest } from 'aws-sdk/clients/sqs';
import { debugOnlyLog, getTechRecordEnvVar } from '../utils/utilities';
import { transformTechRecord } from '../utils/transform-tech-record';
import { BatchItemFailuresResponse } from '../models/BatchItemFailures';

let sqs: SQS;

/**
 * λ function to process a DynamoDB stream and forward it to an appropriate SQS queue.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const edhMarshaller: Handler = async (event: DynamoDBStreamEvent): Promise<BatchItemFailuresResponse> => {
  const res: BatchItemFailuresResponse = {
    batchItemFailures: [],
  };

  if (!event) {
    console.error('ERROR: event is not defined.');
    return res;
  }

  const records: DynamoDBRecord[] = event.Records;

  if (!records || !records.length) {
    console.error('ERROR: No Records in event: ', event);
    return res;
  }

  debugOnlyLog('Records: ', records);

  const sendMessagePromises = [];

  if (!sqs) {
    sqs = AWSXray.captureAWSClient(
      new SQS({
        region: 'eu-west-1',
        apiVersion: '2012-11-05',
      }),
    );
  }
  
  for (const record of records) {
    if(!record.eventID) {
      console.error(`Unable to generate SQS event for record: ${JSON.stringify(record)}, no eventID within payload`)
      continue;
    }

    const id = record.eventID

    debugOnlyLog('Record: ', record);
    debugOnlyLog('New image: ', record.dynamodb?.NewImage);

    const params = getSqsParams(record);

    if (!params) {
      console.error(`Unable to generate SQS event for record: ${JSON.stringify(record)}`);
      continue;
    }

    sendMessagePromises.push(
      sqs.sendMessage(params).promise()
        .then(() => {
          debugOnlyLog('Succesfully sent SQS message');
        })
        .catch(() => {
          console.error(`Failed to push SQS message for record: ${JSON.stringify(record)}`);
          res.batchItemFailures.push({ itemIdentifier: id });
        }),
    );
  }

  await Promise.allSettled(sendMessagePromises);

  return res;
};

const getSqsParams = (record: DynamoDBRecord): SendMessageRequest | undefined => {
  if (record.eventSourceARN && record.eventID) {
    const processFlatTechRecords: boolean = getTechRecordEnvVar();

    let queueUrl: string | undefined = undefined;
  
    if (record.eventSourceARN.includes('test-results')) {
      queueUrl = process.env.TEST_RESULT_DISPATCHER_SQS_URL;
    } else if (record.eventSourceARN.includes('flat-tech-records')) {
      if (!processFlatTechRecords) {
        debugOnlyLog('Ignoring flat-tech-record stream event');
        return undefined;
      }
      transformTechRecord(record);
      queueUrl = process.env.TECHNICAL_RECORDS_DISPATCHER_SQS_URL;
    } else if (record.eventSourceARN.includes('technical-records')) {
      if (processFlatTechRecords) {
        debugOnlyLog('Ignoring technical-record stream event');
        return undefined;
      }
      queueUrl = process.env.TECHNICAL_RECORDS_DISPATCHER_SQS_URL;
    }
  
    if (!queueUrl) {
      console.error(`Unable to retrieve destination SQS queue URL for event originating from eventSourceArn: ${record.eventSourceARN}`);
      return undefined;
    }

    return {
      MessageBody: JSON.stringify(record),
      QueueUrl: queueUrl,
    };
  }
};

export { edhMarshaller };
