import { MessageBodyAttributeMap, SendMessageResult } from 'aws-sdk/clients/sqs';
import { PromiseResult } from 'aws-sdk/lib/request';
import { AWSError, config as AWSConfig } from 'aws-sdk';
import { SqsService } from '../utils/sqs-huge-msg';
import { Configuration } from '../utils/Configuration';
import { ERROR } from '../models/enums';

/**
 * Service class for interfacing with the Simple Queue Service
 */
class SQService {
  private readonly sqsClient: SqsService;

  private readonly config: any;

  /**
     * Constructor for the ActivityService class
     * @param sqsClient - The Simple Queue Service client
     */
  constructor(sqsClient: SqsService) {
    const config: any = Configuration.getInstance().getConfig();
    this.sqsClient = sqsClient;

    if (!config.sqs) {
      throw new Error(ERROR.NO_SQS_CONFIG);
    }

    // Not defining BRANCH will default to local
    const env: string = (!process.env.BRANCH || process.env.BRANCH === 'local') ? 'local' : 'remote';
    this.config = config.sqs[env];

    AWSConfig.sqs = this.config.params;
  }

  /**
     * Send a message to the specified queue (the AWS SQS queue URL is resolved based on the queueName for each message )
     * @param messageBody - A string message body
     * @param messageAttributes - A MessageAttributeMap
     * @param queueName - The queue name
     */
  public async sendMessage(messageBody: string, queueName: string, messageAttributes?: MessageBodyAttributeMap): Promise<void|PromiseResult<SendMessageResult, AWSError>> {
    // Send a message to the queue
    return this.sqsClient.sendMessage(queueName, messageBody, messageAttributes);
  }
}

export { SQService };
