/**
 * Utils functions
 */
import { Configuration } from './Configuration';
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

export const debugOnlyLog = (...args: any) => {
  if (process.env.DEBUG === 'TRUE') {
    console.log(...args);
  }
};
