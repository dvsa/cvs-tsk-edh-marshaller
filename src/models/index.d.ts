import { Record } from 'aws-sdk/clients/dynamodbstreams';

export interface StreamRecord extends Record {
  eventSourceARN: string;
}

export interface TargetConfig {
  [target: string]: {
    queueName: string;
  };
}
