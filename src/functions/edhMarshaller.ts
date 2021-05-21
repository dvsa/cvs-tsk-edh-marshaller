import {
  Callback, Context, DynamoDBRecord, DynamoDBStreamEvent, Handler,
} from 'aws-lambda';
import { AWSError, S3 } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
import SQS, { SendMessageResult } from 'aws-sdk/clients/sqs';
import AWSXRay from 'aws-xray-sdk';
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
const edhMarshaller: Handler = async (event: DynamoDBStreamEvent, context?: Context, callback?: Callback): Promise<void|Array<void|PromiseResult<SendMessageResult, AWSError>>> => {
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
  const bucket = process.env.SQS_BUCKET;
  const branch = process.env.BRANCH;
  const config: any = Configuration.getInstance().getConfig();

  if (!region) {
    console.error('AWS_REGION envvar not available');
    return;
  }

  if (!bucket) {
    console.error('SQS_BUCKET envvar not available');
    return;
  }

  if (!branch) {
    console.error('BRANCH envvar not available');
    return;
  }
  // Not defining BRANCH will default to local
  const env = (!branch || branch === 'local') ? 'local' : 'remote';

  // Instantiate the Simple Queue Service
  const s3 = AWSXRay.captureAWSClient(new S3({
    s3ForcePathStyle: true,
    signatureVersion: 'v2',
    region,
    endpoint: config.s3[env].params.endpoint,
  })) as S3;
  const sqs = AWSXRay.captureAWSClient(new SQS({ region })) as SQS;
  const sqsHugeMessage = new SqsService({
    s3,
    sqs,
    queueName: config.sqs[env].queueName[0],
    s3Bucket: bucket,
    itemPrefix: branch,
  });
  const sqService: SQService = new SQService(sqsHugeMessage);

  const filteredRecords = records.filter(filterRecordsWithoutEventSourceARN);

  // for (const record of filteredRecords) {
  const sendMessagePromises = filteredRecords.map((record): Promise<void|PromiseResult<SendMessageResult, AWSError>> => {
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
