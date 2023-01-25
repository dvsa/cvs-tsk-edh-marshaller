/**
 * Utils functions
 */
import { DynamoDBRecord } from 'aws-lambda';

export const debugOnlyLog = (...args: Array<Record<string, unknown> | string | unknown | DynamoDBRecord[]>) => {
  if (process.env.DEBUG === 'TRUE') {
    console.log(...args);
  }
};
