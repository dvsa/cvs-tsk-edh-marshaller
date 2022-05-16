import { edhMarshaller } from '../../../src/functions/edh-marshaller';
import { SQSService } from '../../../src/services/sqs';
import { Context } from 'aws-lambda';
import * as _ from '../../../src/utils/transform-tech-record';

describe('edhMarshaller Function', () => {
  let ctx: Context;

  afterAll(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe('if the event is undefined', () => {
    it('should return undefined', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'false';

      jest.spyOn(console, 'error');

      await edhMarshaller(undefined, ctx, () => { return; });

      expect(console.error).toHaveBeenCalledWith('ERROR: event is not defined.');
    });
  });

  describe('if the event has no records', () => {
    it('should return undefined', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'false';

      jest.spyOn(console, 'error');

      await edhMarshaller({ something: 'not records' }, ctx, () => { return; });

      expect(console.error).toHaveBeenCalledWith('ERROR: No Records in event: ', { something: 'not records' });
    });
  });

  describe('with good technical-records event', () => {
    const techEvent = {
      Records: [
        {
          eventSourceARN: 'technical-records',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };
    
    it('should not load onto SQS if PROCESS_FLAT_TECH_RECORDS is true', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'true';
      const sendMessageMock = jest.fn().mockResolvedValue('howdy');
      jest
        .spyOn(SQSService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);


      await edhMarshaller(techEvent, ctx, () => { return; });

      expect(sendMessageMock).toHaveBeenCalledTimes(0);
    });

    it('should load onto SQS if PROCESS_FLAT_TECH_RECORDS is false', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'false';
      const sendMessageMock = jest.fn().mockResolvedValue('howdy');
      const transformRecordMock = jest.fn();
      jest
        .spyOn(SQSService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);
      jest
        .spyOn(_, 'transformTechRecord')
        .mockImplementation(transformRecordMock);

      await edhMarshaller(techEvent, ctx, () => { return; });

      expect(transformRecordMock).toHaveBeenCalledTimes(0);
      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({
          eventSourceARN: 'technical-records',
          eventName: 'INSERT',
          dynamodb: { some: 'thing' },
        }),
        'cvs-edh-dispatcher-technical_records-local-queue',
      );
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('with good flat-tech-records event', () => {
    const flatTechEvent = {
      Records: [
        {
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: {
            some: 'thing',
          },
        },
      ],
    };

    it('should load onto SQS if PROCESS_FLAT_TECH_RECORDS is true', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'true';

      const sendMessageMock = jest.fn().mockResolvedValue('howdy');
      const transformRecordMock = jest.fn();
      jest
        .spyOn(SQSService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);
      jest
        .spyOn(_, 'transformTechRecord')
        .mockImplementation(transformRecordMock);

      await edhMarshaller(flatTechEvent, ctx, () => { return; });

      expect(transformRecordMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({
          eventSourceARN: 'flat-tech-records',
          eventName: 'INSERT',
          dynamodb: { some: 'thing' },
        }),
        'cvs-edh-dispatcher-technical_records-local-queue',
      );
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    it('should not load onto SQS if PROCESS_FLAT_TECH_RECORDS is false', async () => {
      process.env.PROCESS_FLAT_TECH_RECORDS = 'false';

      const sendMessageMock = jest.fn().mockResolvedValue('howdy');
      const transformRecordMock = jest.fn();
      jest
        .spyOn(SQSService.prototype, 'sendMessage')
        .mockImplementation(sendMessageMock);
      jest
        .spyOn(_, 'transformTechRecord')
        .mockImplementation(transformRecordMock);

      await edhMarshaller(flatTechEvent, ctx, () => { return; });

      expect(transformRecordMock).toHaveBeenCalledTimes(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(0);
    });
  });
  
  describe('with good test result event', () => {
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

        await expect(edhMarshaller(event, ctx, () => {return;})).rejects.toBe('It broke');
        expect(console.log).toHaveBeenCalledWith('records', [{
          dynamodb: {
            some: 'thing',
          },
          eventName: 'INSERT',
          eventSourceARN: 'test-results',
        }]);
        expect(console.error).toHaveBeenCalledWith('It broke');

      });
    });
  });
});
