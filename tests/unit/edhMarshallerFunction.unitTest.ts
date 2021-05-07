import { Context } from 'aws-lambda';
import { SqsService } from '../../src/utils/sqs-huge-msg';
import { SQService } from '../../src/services/SQService';
import { edhMarshaller } from '../../src/functions/edhMarshaller';

jest.mock('../../src/utils/sqs-huge-msg');
jest.mock('../../src/services/SQService');

describe('EDH Marshaller', () => {
  it('returns undefined when there is no event', async () => {
    expect.assertions(1);
    const result = await edhMarshaller(undefined, null as unknown as Context, () => { });
    expect(result).toBe(undefined);
  });

  it('returns undefined when three are no records in the event', async () => {
    expect.assertions(1);
    const result = await edhMarshaller({ something: 'not records' }, null as unknown as Context, () => { });
    expect(result).toBe(undefined);
  });

  it('should send a message with a good event', async () => {
    const event = {
      Records: [{
        eventSourceARN: 'test-results',
        eventName: 'INSERT',
        dynamodb: {
          some: 'thing',
        },
      }],
    };

    const sendMessageMock = jest.fn().mockResolvedValue('howdy');
    jest.spyOn(SQService.prototype, 'sendMessage').mockImplementation(sendMessageMock);

    const response = await edhMarshaller(event, null as unknown as Context, () => { });

    expect(response).toEqual(['howdy']);
  });

  it('should throw if the SqService throws an error', async () => {
    const event = {
      Records: [{
        eventSourceARN: 'test-results',
        eventName: 'INSERT',
        dynamodb: {
          some: 'thing',
        },
      }],
    };

    jest.spyOn(SQService.prototype, 'sendMessage').mockRejectedValue(new Error());

    await expect(edhMarshaller(event, null as unknown as Context, () => { })).rejects.toThrow();
  });
});
