import {Callback, Context, Handler} from "aws-lambda";
import {AWSError, SQS} from "aws-sdk";
import {SQService} from "../services/SQService";
import {PromiseResult} from "aws-sdk/lib/request";
import {SendMessageResult} from "aws-sdk/clients/sqs";
import {GetRecordsOutput} from "aws-sdk/clients/dynamodbstreams";
import {debugOnlyLog, getTargetQueueFromSourceARN} from "../utils/Utils";
import {StreamRecord} from "../models";

/**
 * λ function to process a DynamoDB stream of test results into a queue for certificate generation.
 * @param event - DynamoDB Stream event
 * @param context - λ Context
 * @param callback - callback function
 */
const edhMarshaller: Handler = async (event: GetRecordsOutput, context?: Context, callback?: Callback): Promise<void | Array<PromiseResult<SendMessageResult, AWSError>>> => {
    if (!event) {
        console.error("ERROR: event is not defined.");
        return;
    }
    const records = event.Records as StreamRecord[];
    if (!records || !records.length) {
        console.error("ERROR: No Records in event: ", event);
        return;
    }

    debugOnlyLog("Records: ", records);

    // Instantiate the Simple Queue Service
    const sqService: SQService = new SQService(new SQS());
    const sendMessagePromises: Array<Promise<PromiseResult<SendMessageResult, AWSError>>> = [];

    records.forEach((record: StreamRecord) => {
        debugOnlyLog("Record: ", record);
        debugOnlyLog("New image: ", record.dynamodb?.NewImage);
        const targetQueue = getTargetQueueFromSourceARN(record.eventSourceARN);
        debugOnlyLog("Target Queue", targetQueue);
        const eventType = record.eventName; //INSERT, MODIFY or REMOVE
        const message = {
            eventType,
            body: record.dynamodb
        };
        debugOnlyLog("Output message", message);
        sendMessagePromises.push(sqService.sendMessage(JSON.stringify(message), targetQueue))
    });

    return Promise.all(sendMessagePromises)
    .catch((error: AWSError) => {
        console.error(error);
        console.log("records");
        console.log(records);
        // Lambda will retry up to X times or until the message expires, after which the message will be sent to the dlq.
        throw error;
    });
};

export {edhMarshaller};
