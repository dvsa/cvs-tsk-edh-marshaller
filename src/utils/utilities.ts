/**
 * Utils functions
 */
import { DynamoDBRecord } from 'aws-lambda';
import { Configuration } from './config';
import { ERROR } from '../models/enums';

export const getTargetQueueFromSourceARN = (arn: string) => {
  const targets = Configuration.getInstance().getTargets();
  const targetNames = Object.keys(targets);
  const validTargets = targetNames.filter((name) => arn.includes(name));
  if (validTargets.length !== 1) {
    debugOnlyLog('valid targets: ', validTargets);
    throw new Error(ERROR.NO_UNIQUE_TARGET);
  }
  return targets[validTargets[0]].queueName;
};

export const debugOnlyLog = (...args: Array<Record<string, unknown> | string | unknown | DynamoDBRecord[]>) => {
  if (process.env.DEBUG === 'TRUE') {
    console.log(...args);
  }
};
