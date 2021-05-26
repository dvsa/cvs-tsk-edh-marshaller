import * as AWS from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
import { v4 as uuid } from 'uuid';
import { MessageBodyAttributeMap } from 'aws-sdk/clients/sqs';

export interface SqsServiceOptions {
  s3: AWS.S3;
  sqs: AWS.SQS;
  queueName: string;
  maxMessageSize?: number;
  s3Bucket: string;
  itemPrefix?: string;
}

export enum SqsServiceMessage {
  MAX_SQS_MESSAGE_SIZE = 256 * 1024
}
export class SqsService {
  private s3: AWS.S3;

  private sqs: AWS.SQS;

  private queueName: string;

  private maxMessageSize: number;

  private s3Bucket: string;

  private itemPrefix?: string;

  constructor(options: SqsServiceOptions) {
    this.s3 = options.s3;
    this.sqs = options.sqs;
    this.queueName = options.queueName;
    this.maxMessageSize = options.maxMessageSize || SqsServiceMessage.MAX_SQS_MESSAGE_SIZE;
    this.s3Bucket = options.s3Bucket;
    this.itemPrefix = options.itemPrefix;
  }

  private async deleteMessage(queueName: string, message: any): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);

    if (queueUrl === undefined) {
      return;
    }

    await this.sqs
      .deleteMessage({
        QueueUrl: queueUrl,
        ReceiptHandle: message.Messages[0].ReceiptHandle,
      }).promise();
  }

  public async getQueueUrl(queueName: string): Promise<string|undefined> {
    const { QueueUrl } = await this.sqs
      .getQueueUrl({
        QueueName: queueName || this.queueName,
      }).promise();

    return QueueUrl;
  }

  public async sendMessage(queueName: string, body: string, messageAttributes?: MessageBodyAttributeMap): Promise<void|PromiseResult<AWS.SQS.SendMessageResult, AWS.AWSError>> {
    const msgSize = Buffer.byteLength(body, 'utf-8');
    const queueUrl = await this.getQueueUrl(queueName);

    if (queueUrl === undefined) {
      throw new Error('Queue URL not found');
    }

    if (msgSize < this.maxMessageSize) {
      const messageConfig = {
        QueueUrl: queueUrl,
        MessageBody: body,
        MessageAttributes: messageAttributes,
      };

      return this.sqs.sendMessage(messageConfig).promise();
    }

    const keyId: string = uuid();
    const payloadId = this.itemPrefix !== undefined ? `${this.itemPrefix}/${keyId}.json` : `${keyId}.json`;

    const responseBucket = await this.s3.upload({
      Bucket: this.s3Bucket,
      Body: body,
      Key: payloadId,
    }).promise();

    const messageConfig = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        S3Payload: {
          Id: payloadId,
          Key: responseBucket.Key,
          Location: responseBucket.Location,
        },
      }),
      MessageAttributes: messageAttributes,
    };

    return this.sqs.sendMessage(messageConfig).promise();
  }

  public async getMessage(queueName: string): Promise<PromiseResult<AWS.SQS.ReceiveMessageResult, AWS.AWSError>|void> {
    const queueUrl = await this.getQueueUrl(queueName);

    if (queueUrl === undefined) {
      return Promise.resolve();
    }

    const message = await this.sqs
      .receiveMessage({ QueueUrl: queueUrl }).promise();

    const messages = message.Messages;

    if (!messages || messages.length === 0) {
      return Promise.resolve();
    }

    const { Body } = messages[0];
    if (Body !== undefined) {
      messages[0].Body = await this.getMessageContent(Body);
    }

    await this.deleteMessage(queueName, message);

    return message;
  }

  public async getMessageContent(body: string): Promise<string> {
    const parsedBody = JSON.parse(body) as MessageBody;
    if (parsedBody.S3Payload) {
      const s3Object = await this.s3
        .getObject({
          Bucket: this.s3Bucket,
          Key: parsedBody.S3Payload.Key,
        })
        .promise();

      if (s3Object.Body === undefined) {
        throw new Error('Body missing from S3 object');
      }

      return s3Object.Body.toString();
    }

    return body;
  }
}

interface MessageBody {
  S3Payload?: S3Payload;
}

interface S3Payload {
  Key: string;
}
