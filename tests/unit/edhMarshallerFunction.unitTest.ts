import {edhMarshaller} from "../../src/functions/edhMarshaller";
import mockContext from "aws-lambda-mock-context";
import {SQService} from "../../src/services/SQService";
import {Configuration} from "../../src/utils/Configuration";
import {Context} from "aws-lambda";

describe("edhMarshaller Function", () => {
  // @ts-ignore
  const ctx: Context = null;
  // @ts-ignore
  Configuration.instance = new Configuration("../../src/config/config.yml");
  afterAll(() => {
    jest.restoreAllMocks();
    jest.resetModuleRegistry();
  });

  describe("if the event is undefined", () => {
    it("should return undefined", async () => {
      expect.assertions(1);
      const result = await edhMarshaller(undefined, ctx, () => { return; });
      expect(result).toBe(undefined);
    });
  });

  describe("if the event has no records", () => {
    it("should return undefined", async () => {
      expect.assertions(1);
      const result = await edhMarshaller({something: "not records"}, ctx, () => { return; });
      expect(result).toBe(undefined);
    });
  });

  describe("with good event", () => {
    const event = {
      Records: [{
        "eventSourceARN":"test-results",
        "eventName":"INSERT",
        "dynamodb":{
          "some": "thing"
        }
      }]
    };
    it("should invoke SQS service with correct params", async () => {
      const sendMessageMock = jest.fn().mockResolvedValue("howdy");
      jest.spyOn(SQService.prototype, "sendMessage").mockImplementation(sendMessageMock);

      await edhMarshaller(event, ctx, () => { return; });
      expect(sendMessageMock).toHaveBeenCalledWith(
        JSON.stringify({
          eventSourceARN: "test-results",
          eventName:"INSERT",
          dynamodb: {"some":"thing"},
        }),
        "cvs-edh-dispatcher-test-results-local-queue"
      );
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    describe("when SQService throws an error", () => {
      it("should throw the error up", async () => {
        jest.spyOn(SQService.prototype, "sendMessage").mockRejectedValue("It broke");

        try {
          await edhMarshaller(event, ctx, () => { return; });
        } catch (e) {
          expect(e).toEqual("It broke");
        }
      });
    })
  });
});
