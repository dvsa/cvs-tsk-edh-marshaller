import { SQSService } from '../../../src/services/sqs';
import { Configuration } from '../../../src/utils/config';
import { ERROR } from '../../../src/models/enums';
import { SQS } from 'aws-sdk';

describe('SQSService', () => {
  describe('Constructor', () => {
    const sqclientMock = jest.fn().mockImplementation(() => {
      return {
        customizeRequests: jest.fn(),
      };
    });
    it('grabs config and populates the SQS client with provided', () => {
      const liveMock = new sqclientMock() as SQS;
      const svc = new SQSService(liveMock);
      expect(svc.client).toEqual(liveMock);
      expect(svc.configuration).toBeDefined();
    });

    describe('with No config available', () => {
      it('throws an error', () => {
        jest
          .spyOn(Configuration, 'getInstance')
          .mockReturnValue({
            getConfig: () => {
              return {};
            },
            getTargets: () => {
              return {};
            },
          } as Configuration);

        expect(() => new SQSService(new sqclientMock() as SQS))
          .toThrow(ERROR.NO_SQS_CONFIG);
      });
    });
  });

  describe('sendMessage', () => {
    describe('with good inputs', () => {
      const sendMock = jest
        .fn()
        .mockReturnValue({ promise: jest.fn().mockResolvedValue('It worked') });
      const sqclientMock = jest.fn().mockImplementation(() => {
        return {
          sendMessage: sendMock,
          getQueueUrl: () => {
            return {
              promise: jest.fn().mockResolvedValue({ QueueUrl: 'testURL' }),
            };
          },
          customizeRequests: jest.fn(),
        };
      });
      const liveMock = new sqclientMock() as SQS;
      const svc = new SQSService(liveMock);
      const expectedSendArgs = { MessageBody: 'my thing', QueueUrl: 'testURL' };
      it("doesn't throw an error", async () => {
        expect.assertions(3);
        const output = await svc.sendMessage('my thing', 'aQueue');
        expect(output).toBe('It worked');
        expect(sendMock).toHaveBeenCalledWith(expectedSendArgs);
        expect(sendMock).toHaveBeenCalledTimes(1);
      });

      describe('and specify attributes', () => {
        it('adds the attributes to the call params', async () => {
          sendMock.mockReset();
          sendMock.mockReturnValue({
            promise: jest.fn().mockResolvedValue('It worked'),
          });
          expect.assertions(3);
          const attrMap = { a: { DataType: 'b' } };
          const output = await svc.sendMessage('my thing', 'aQueue', attrMap);
          expect(output).toBe('It worked');
          expect(sendMock).toHaveBeenCalledWith({
            ...expectedSendArgs,
            MessageAttributes: attrMap,
          });
          expect(sendMock).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
