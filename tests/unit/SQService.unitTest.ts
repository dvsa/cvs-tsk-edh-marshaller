import { mocked } from 'ts-jest';
import { PromiseResult } from 'aws-sdk/lib/request';
import { SQService } from '../../src/services/SQService';
import { SqsService } from '../../src/utils/sqs-huge-msg';
import { Configuration } from '../../src/utils/Configuration';
import { ERROR } from '../../src/models/enums';


describe('SQService', () => {
  it('throws an error when there is no config available', () => {
    jest.spyOn(Configuration, 'getInstance').mockReturnValue({
      getConfig: () => ({}),
      getTargets: () => ({}),
    } as Configuration);
    expect(() => {
      new SQService(
        new SqsService(
          {
            s3: {} as AWS.S3,
            sqs: {} as AWS.SQS,
            queueName: 'local',
            s3Bucket: '',
          },
        ),
      );
    }).toThrow(ERROR.NO_SQS_CONFIG);
  });

  it('successfully sends a message', async () => {
    jest.mock('../../src/utils/sqs-huge-msg');
    jest.spyOn(Configuration, 'getInstance').mockReturnValue({
      getConfig: () => ({ sqs: { local: { params: {} } } }),
      getTargets: () => ({}),
    } as Configuration);

    const sqsService = new SqsService(
      {
        s3: {} as AWS.S3,
        sqs: {} as AWS.SQS,
        queueName: 'local',
        s3Bucket: '',
      },
    ) as jest.Mocked<SqsService>;

    sqsService.sendMessage = jest.fn().mockResolvedValue({ MessageId: 1234 } as unknown as PromiseResult<AWS.SQS.SendMessageResult, AWS.AWSError>);

    const sqService = new SQService(sqsService);

    const response = await sqService.sendMessage('test', 'queue') as any;

    expect(response.MessageId).toEqual(1234);
  });
});
