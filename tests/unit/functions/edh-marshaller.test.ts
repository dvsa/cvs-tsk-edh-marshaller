/* eslint-disable jest/no-conditional-expect */
import { edhMarshaller } from '../../../src/functions/edh-marshaller';
import { SQSService } from '../../../src/services/sqs';
import { Context } from 'aws-lambda';

describe('edhMarshaller Function', () => {
  let ctx: Context;

  afterAll(() => {
    jest.restoreAllMocks();
    jest.resetModules();
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

  describe('with good event', () => {
    const event = {
      Records: [
        {
          eventSourceARN: 'test-results',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };
    it('should invoke SQS service with correct params', async () => {
      const sendMessageMock = jest.fn().mockResolvedValue('howdy');
      jest
        .spyOn(SQSService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);

      await edhMarshaller(event, ctx, () => { return; });

      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({
          eventSourceARN: 'test-results',
          eventName: 'INSERT',
          dynamodb: { some: 'thing' },
        }),
        'cvs-edh-dispatcher-test-results-local-queue',
      );
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    describe('when SQService throws an error', () => {
      it('should throw the error up', async () => {
        jest
          .spyOn(SQSService.prototype, 'sendMessage')
          .mockRejectedValue('It broke');
        jest.spyOn(console, 'error');
        jest.spyOn(console, 'log');

        try {
          await edhMarshaller(event, ctx, () => {
            return;
          });
        } catch (e) {
          expect(console.log).toHaveBeenCalledWith('records', [{
            dynamodb: {
              some: 'thing',
            },
            eventName: 'INSERT',
            eventSourceARN: 'test-results',
          }]);
          expect(console.error).toHaveBeenCalledWith('It broke');
          expect(e).toBe('It broke');
        }
      });
    });
  });
});
