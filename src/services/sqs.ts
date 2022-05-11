import SQS, {
  GetQueueUrlResult,
  MessageBodyAttributeMap,
  SendMessageResult,
} from 'aws-sdk/clients/sqs';
import { PromiseResult } from 'aws-sdk/lib/request';
import AWSXRay from 'aws-xray-sdk';
import { AWSError, config as AWSConfig } from 'aws-sdk';
import { ERROR } from '../models/enums';
import { Configuration, MarshallerConfig } from '../utils/configuration';
// eslint-disable-next-line

interface SQSConfig {
  params: SQS.ClientConfiguration;
  queueName: [];
}

/**
 * Service class for interfacing with the Simple Queue Service
 */
class SQService {
  private readonly sqsClient: SQS;

  private readonly config: SQSConfig;

  /**
   * Constructor for the ActivityService class
   * @param sqsClient - The Simple Queue Service client
   */
  constructor(sqsClient: SQS) {
    const config: MarshallerConfig = Configuration.getInstance().getConfig();
    this.sqsClient = AWSXRay.captureAWSClient(sqsClient);

    if (!config.sqs) {
      throw new Error(ERROR.NO_SQS_CONFIG);
    }

    // Not defining BRANCH will default to local
    this.config = config.sqs[!process.env.BRANCH || process.env.BRANCH === 'local' ? 'local' : 'remote'];

    AWSConfig.sqs = this.config.params;
  }

  /**
   * Send a message to the specified queue (the AWS SQS queue URL is resolved based on the queueName for each message )
   * @param messageBody - A string message body
   * @param messageAttributes - A MessageAttributeMap
   * @param queueName - The queue name
   */
  public async sendMessage(messageBody: string, queueName: string, messageAttributes?: MessageBodyAttributeMap): Promise<PromiseResult<SendMessageResult, AWSError>> {
    // Get the queue URL for the provided queue name
    const queueUrlResult: GetQueueUrlResult = await this.sqsClient
      .getQueueUrl({ QueueName: queueName })
      .promise();

    const params = {
      QueueUrl: queueUrlResult.QueueUrl,
      MessageBody: messageBody,
    };

    if (messageAttributes) {
      Object.assign(params, {
        MessageAttributes: {
          ...messageAttributes,
          AWSTraceHeader: process.env._X_AMZN_TRACE_ID,
        },
      });
    }

    // Send a message to the queue
    return this.sqsClient
      .sendMessage(params as SQS.Types.SendMessageRequest)
      .promise();
  }
}

export { SQService };
