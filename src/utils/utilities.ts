/**
 * Utils functions
 */
import { DynamoDBRecord } from 'aws-lambda';
import { Configuration } from './config';
import { ERROR } from '../models/enums';

export const getTechRecordEnvVar = (): boolean => {
  if (process.env.PROCESS_FLAT_TECH_RECORDS == 'false') {
    return false;
  } else if (process.env.PROCESS_FLAT_TECH_RECORDS == 'true') {
    return true;
  }
  throw Error('PROCESS_FLAT_TECH_RECORDS environment variable must be true or false');
};

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
