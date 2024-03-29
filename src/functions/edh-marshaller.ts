import {
  DynamoDBRecord,
  DynamoDBStreamEvent,
  Handler,
} from 'aws-lambda';
import { SQS } from 'aws-sdk';
import { SendMessageRequest } from 'aws-sdk/clients/sqs';
import AWSXray from 'aws-xray-sdk';
import { BatchItemFailuresResponse } from '../models/BatchItemFailures';
import { transformTechRecord } from '../utils/transform-tech-record';
import { debugOnlyLog } from '../utils/utilities';

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

  if (!records?.length) {
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
        httpOptions: {
          timeout: 5000,
        },
      }),
    );
  }

  for (const record of records) {
    if (!record.eventID) {
      console.error(`Unable to generate SQS event for record: ${JSON.stringify(record)}, no eventID within payload`);
      continue;
    }

    const id = record.eventID;

    debugOnlyLog('Record: ', record);
    debugOnlyLog('New image: ', record.dynamodb?.NewImage);

    const params = getSqsParams(record);

    if (!params) {
      continue;
    }

    sendMessagePromises.push(
      sqs.sendMessage(params).promise()
        .then(() => debugOnlyLog('Succesfully sent SQS message'))
        .catch((err) => {
          console.error(JSON.stringify(err));
          console.error(`Failed to push SQS message for record: ${JSON.stringify(record)}`);
          res.batchItemFailures.push({ itemIdentifier: id });
        }),
    );
  }

  await Promise.allSettled(sendMessagePromises);

  return res;
};

const getSqsParams = (record: DynamoDBRecord): SendMessageRequest | undefined => {
  if (!record.eventSourceARN) {
    console.error(`Unable to generate SQS event for record: ${JSON.stringify(record)} eventSourceArn must be defined`);
    return undefined;
  }

  let queueUrl: string | undefined = undefined;

  if (record.eventSourceARN.includes('test-results')) {
    queueUrl = process.env.TEST_RESULT_UPDATE_STORE_SQS_URL;
  } else if (record.eventSourceARN.includes('flat-tech-records')) {
    transformTechRecord(record);
    queueUrl = process.env.TECHNICAL_RECORDS_UPDATE_STORE_SQS_URL;
  }

  if (!queueUrl) {
    console.error(`Unable to retrieve destination SQS queue URL for record: ${JSON.stringify(record)}`);
    return undefined;
  }

  return {
    MessageBody: JSON.stringify(record),
    QueueUrl: queueUrl,
  };
};

export { edhMarshaller };
