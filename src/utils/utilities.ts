/**
 * Utils functions
 */
import { DynamoDBRecord } from 'aws-lambda';

export const getTechRecordEnvVar = (): boolean => {
  if (process.env.PROCESS_FLAT_TECH_RECORDS == 'true') {
    return true;
  }
  return false;
};

export const debugOnlyLog = (...args: Array<Record<string, unknown> | string | unknown | DynamoDBRecord[]>) => {
  if (process.env.DEBUG === 'TRUE') {
    console.log(...args);
  }
};
