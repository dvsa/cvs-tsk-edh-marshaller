import { edhMarshaller } from '../../../src/functions/edh-marshaller';
import { SQService } from '../../../src/services/sqs';
import { Configuration } from '../../../src/utils/configuration';
import { Context } from 'aws-lambda';

describe('edhMarshaller Function', () => {
  // @ts-ignore
  const ctx: Context = null;
  // @ts-ignore
  Configuration.instance = new Configuration('../../src/config/config.yml');
  afterAll(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe('if the event is undefined', () => {
    it('should return undefined', async () => {
      expect.assertions(1);
      const result = await edhMarshaller(undefined, ctx, () => {
        return;
      });
      expect(result).toBeUndefined();
    });
  });

  describe('if the event has no records', () => {
    it('should return undefined', async () => {
      expect.assertions(1);
      const result = await edhMarshaller(
        { something: 'not records' },
        ctx,
        () => {
          return;
        },
      );
      expect(result).toBeUndefined();
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
        .spyOn(SQService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);

      await edhMarshaller(event, ctx, () => {
        return;
      });
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
          .spyOn(SQService.prototype, 'sendMessage')
          .mockRejectedValue('It broke');

        try {
          await edhMarshaller(event, ctx, () => {
            return;
          });
        } catch (e) {
          expect(e).toBe('It broke');
        }
      });
    });
  });
});
