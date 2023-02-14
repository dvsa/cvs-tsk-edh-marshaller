import { edhMarshaller } from '../../../src/functions/edh-marshaller';
import { Context } from 'aws-lambda';
import * as _ from '../../../src/utils/transform-tech-record';
import AWSXray from 'aws-xray-sdk';
import { SQS, AWSError, Service, Response } from 'aws-sdk';
import { SendMessageRequest } from 'aws-sdk/clients/sqs';
import { BatchItemFailuresResponse } from '../../../src/models/BatchItemFailures';

type PromiseResult<D, E> = D & { $response: Response<D, E> };

const mSendMessage = jest.fn();

class SqsMock extends Service {
  sendMessage(params: SendMessageRequest) {
    mSendMessage(params);

    return { 
      promise: jest.fn().mockImplementation(() => params.QueueUrl === 'FAIL' 
        ? Promise.reject(<PromiseResult<SQS.SendMessageResult, AWSError>>{})
        : Promise.resolve(<PromiseResult<SQS.SendMessageResult, AWSError>>{}),
      ),
    };
  }
}

describe('edhMarshaller Function', () => {
  let ctx: Context;

  jest.spyOn(AWSXray, 'captureAWSClient').mockImplementation(() => {
    return new SqsMock();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('if the event is undefined', () => {
    it('should return undefined', async () => {
      jest.spyOn(console, 'error');

      await edhMarshaller(undefined, ctx, () => { return; });

      expect(console.error).toHaveBeenCalledWith('ERROR: event is not defined.');
    });
  });

  describe('if the event has no records', () => {
    it('should return undefined', async () => {
      jest.spyOn(console, 'error');

      await edhMarshaller({ something: 'not records' }, ctx, () => { return; });

      expect(console.error).toHaveBeenCalledWith('ERROR: No Records in event: ', { something: 'not records' });
    });
  });

  describe('with good flat-tech-records event', () => {
    const flatTechEvent = {
      Records: [
        {
          eventID: '2222',
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };

    it('should load onto SQS after transformation', async () => {
      process.env.TECHNICAL_RECORDS_UPDATE_STORE_SQS_URL = 'URL';

      const transformRecordMock = jest.fn();
      jest
        .spyOn(_, 'transformTechRecord')
        .mockImplementation(transformRecordMock);

      await edhMarshaller(flatTechEvent, ctx, () => { return; });

      expect(transformRecordMock).toHaveBeenCalledTimes(1);
      expect(mSendMessage).toHaveBeenCalledWith({
        MessageBody: JSON.stringify({
          eventID: '2222',
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: { some: 'thing' },
        }),
        QueueUrl: 'URL',
      });
      expect(mSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('with good test result event', () => {
    const event = {
      Records: [
        {
          eventID: '2222',
          eventSourceARN: 'test-results',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };

    it('should invoke SQS service with correct params', async () => {
      process.env.TEST_RESULT_UPDATE_STORE_SQS_URL = 'URL';

      await edhMarshaller(event, ctx, () => { return; });

      expect(mSendMessage).toHaveBeenCalledTimes(1);
      expect(mSendMessage).toHaveBeenCalledWith({
        MessageBody: JSON.stringify({
          eventID: '2222',
          eventSourceARN: 'test-results',
          eventName: 'INSERT',
          dynamodb: { some: 'thing' },
        }),
        QueueUrl: 'URL',
      });
    });

    describe('when SQService throws an error', () => {
      it('should throw the error up', async () => {
        process.env.TEST_RESULT_UPDATE_STORE_SQS_URL = 'FAIL';

        jest.spyOn(console, 'error');

        const result = await edhMarshaller(event, ctx, () => {return;}) as BatchItemFailuresResponse;

        expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: '2222' }] });
        expect(mSendMessage).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(`Failed to push SQS message for record: ${JSON.stringify(event.Records[0])}`);
      });
    });
  });

  describe('with multiple events', () => {
    const events = {
      Records: [
        {
          eventID: '4321',
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
        {
          eventID: '1111',
          eventSourceARN: 'test-results',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
        {
          eventID: '1234',
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };

    describe('when SQS throws an error once', () => {
      it('processes rest of records and returns eventID of failed for retry', async () => {
        process.env.TEST_RESULT_UPDATE_STORE_SQS_URL = 'FAIL';
        process.env.TECHNICAL_RECORDS_UPDATE_STORE_SQS_URL = 'SUCCESS';

        jest.spyOn(console, 'error');

        const result = await edhMarshaller(events, ctx, () => {return;}) as BatchItemFailuresResponse;

        expect(mSendMessage).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: '1111' }] });
        expect(console.error).toHaveBeenCalledWith(`Failed to push SQS message for record: ${JSON.stringify(events.Records[1])}`);
      });
    });
  });
});
