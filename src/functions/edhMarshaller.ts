import {
  Callback, Context, DynamoDBRecord, DynamoDBStreamEvent, Handler,
} from 'aws-lambda';
import { AWSError } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
import { SendMessageResult } from 'aws-sdk/clients/sqs';
import { SqsService } from '../utils/sqs-huge-msg';
import { SQService } from '../services/SQService';
import { debugOnlyLog, getTargetQueueFromSourceARN } from '../utils/Utils';
import { Configuration } from '../utils/Configuration';

function filterRecordsWithoutEventSourceARN(record: DynamoDBRecord): record is DynamoDBRecordWithEventSourceArn {
  return record.eventSourceARN !== undefined;
}

/**
 * λ function to process a DynamoDB stream of test results into a queue for certificate generation.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const edhMarshaller: Handler = async (event: DynamoDBStreamEvent, context?: Context, callback?: Callback): Promise<void|Array<PromiseResult<SendMessageResult, AWSError>>> => {
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
  const region = process.env.AWS_REGION;
  const config: any = Configuration.getInstance().getConfig();

  if (!region) {
    console.error('AWS_REGION envvar not available');
    return;
  }

  // Instantiate the Simple Queue Service
  const sqsHugeMessage = new SqsService({
    region,
    queueName: config.queueName,
    s3EndpointUrl: config.s3.remote.params.endpoint,
    s3Bucket: 'BUCKET_NAME',
  });
  const sqService: SQService = new SQService(sqsHugeMessage);
  // const sendMessagePromises: Array<Promise<PromiseResult<SendMessageResult, AWSError>>> = [];

  const filteredRecords = records.filter(filterRecordsWithoutEventSourceARN);

  // for (const record of filteredRecords) {
  const sendMessagePromises = filteredRecords.map((record): Promise<PromiseResult<SendMessageResult, AWSError>> => {
    debugOnlyLog('Record: ', record);
    debugOnlyLog('New image: ', record.dynamodb?.NewImage);

    const targetQueue = getTargetQueueFromSourceARN(record.eventSourceARN);

    debugOnlyLog('Target Queue', targetQueue);

    return sqService.sendMessage(
      JSON.stringify(record),
      targetQueue,
    );
  });


  return Promise.all(sendMessagePromises)
    .catch((error: AWSError) => {
      console.error(error);
      console.log('records');
      console.log(records);
      if (error.code !== 'InvalidParameterValue') {
        throw error;
      }
    });
};

export { edhMarshaller };

interface DynamoDBRecordWithEventSourceArn extends DynamoDBRecord {
  eventSourceARN: string;
}
