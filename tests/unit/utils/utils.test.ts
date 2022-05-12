/* eslint-disable @typescript-eslint/ban-ts-comment */
import { getTargetQueueFromSourceARN } from '../../../src/utils/utils';
import { Configuration } from '../../../src/utils/configuration';
import { ERROR } from '../../../src/models/enums';

describe('utils', () => {
  describe('getTargetQueue', () => {
    describe('when ARN has a matching config', () => {
      it('gets target from config properly', () => {
        const expected = Configuration.getInstance().getTargets()['test-results'].queueName;
        const target = getTargetQueueFromSourceARN('arn:aws:dynamodb:horse-east-8:00626016:table/cvs-cvsb-xxx-test-results/stream/2024-03-30T15:55:39.197');

        expect(target).toEqual(expected);
      });
    });

    describe('when ARN has no matching config', () => {
      it('throws error', () => {
        expect(() => getTargetQueueFromSourceARN('arn:aws:dynamodb:horse-east-8:00626016:table/cvs-cvsb-xxx-NO-MATCHING/stream/2024-03-30T15:55:39.197'))
          .toThrow(ERROR.NO_UNIQUE_TARGET);
      });
    });
  });
});
