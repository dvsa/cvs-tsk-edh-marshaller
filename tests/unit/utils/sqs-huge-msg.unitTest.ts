import fs from 'fs';
import { SqsService } from '../../../src/utils/sqs-huge-msg';

describe('SQS Large Message Handler', () => {
  describe('sendMessage', () => {
    it('correctly sends a small message', async () => {
      const mockS3 = {} as AWS.S3;
      const mockSqs = {
        sendMessage: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue('success'),
        }),
        getQueueUrl: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ QueueUrl: 'http://queueUrl' }) }),
      } as unknown as AWS.SQS;
      const queueName = 'testQueue';
      const s3Bucket = 'testBucket';

      const sqsService = new SqsService({
        s3: mockS3, sqs: mockSqs, queueName, s3Bucket,
      });

      const response = await sqsService.sendMessage(queueName, 'testBody');

      expect(response).toEqual('success');
    });

    it('correctly sends a large message', async () => {
      const largeMessage = fs.readFileSync('./tests/resources/fake-large-message.txt', { encoding: 'utf-8' });
      const mockSendMessagePromise = jest.fn().mockResolvedValue('success');
      const mockUploadPromise = jest.fn().mockResolvedValue({ Key: 'key', Location: 'location' });
      const mockUpload = jest.fn().mockReturnValue({ promise: mockUploadPromise });
      const mockS3 = { upload: mockUpload } as unknown as AWS.S3;
      const mockSqs = {
        sendMessage: jest.fn().mockReturnValue({
          promise: mockSendMessagePromise,
        }),
        getQueueUrl: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ QueueUrl: 'http://queueUrl' }) }),
      } as unknown as AWS.SQS;
      const queueName = 'testQueue';
      const s3Bucket = 'testBucket';

      const sqsService = new SqsService({
        s3: mockS3, sqs: mockSqs, queueName, s3Bucket,
      });

      const response = await sqsService.sendMessage(queueName, largeMessage);

      expect(mockUpload.mock.calls).toHaveLength(1);
      expect(response).toEqual('success');
    });

    it('adds the item prefix if one is specified', async () => {
      const largeMessage = fs.readFileSync('./tests/resources/fake-large-message.txt', { encoding: 'utf-8' });
      const mockSendMessagePromise = jest.fn().mockResolvedValue('success');
      const mockUploadPromise = jest.fn().mockResolvedValue({ Key: 'key', Location: 'location' });
      const mockUpload = jest.fn().mockReturnValue({ promise: mockUploadPromise });
      const mockS3 = { upload: mockUpload } as unknown as AWS.S3;
      const mockSqs = {
        sendMessage: jest.fn().mockReturnValue({
          promise: mockSendMessagePromise,
        }),
        getQueueUrl: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ QueueUrl: 'http://queueUrl' }) }),
      } as unknown as AWS.SQS;
      const queueName = 'testQueue';
      const s3Bucket = 'testBucket';

      const sqsService = new SqsService({
        s3: mockS3, sqs: mockSqs, queueName, s3Bucket, itemPrefix: 'prefix',
      });

      const response = await sqsService.sendMessage(queueName, largeMessage);

      expect(mockUpload.mock.calls).toHaveLength(1);
      const uploadOptions = mockUpload.mock.calls[0][0];
      expect(uploadOptions.Key).toMatch(/^prefix?/);
      expect(response).toEqual('success');
    });

    it('throws an error if no queue url is found', async () => {
      const mockS3 = {} as AWS.S3;
      const mockSqs = {
        sendMessage: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue('success'),
        }),
        getQueueUrl: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }),
      } as unknown as AWS.SQS;
      const queueName = 'testQueue';
      const s3Bucket = 'testBucket';

      const sqsService = new SqsService({
        s3: mockS3, sqs: mockSqs, queueName, s3Bucket,
      });

      await expect(sqsService.sendMessage(queueName, 'testBody')).rejects.toThrow();
    });
  });
});
