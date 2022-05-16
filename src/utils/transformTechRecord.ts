import { DynamoDBRecord, AttributeValue } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

interface LegacyKeyStructure {
  [index: string]: string | boolean | number | Array<string> | Array<object> | LegacyKeyStructure;
}

interface NewKeyStructure {
  [index: string]: string | boolean | number | Array<string>;
}

interface LegacyTechRecord extends LegacyKeyStructure {
  techRecord: object[]
}

const nestItem = (record: LegacyKeyStructure, key: string, value: string | number | boolean | string[], position: number) => {
  const idx = key.indexOf('_', position);

  if (idx === -1) {
    record[key.substring(position)] = value;
    return;
  }
  const realKey = key.substring(position, idx);
  const isArray = !isNaN(parseInt(key[idx + 1]));

  if (!record[realKey.toString()]) {
    if (isArray) {
      record[realKey.toString()] = [];
    } else {
      record[realKey.toString()] = {};
    }
  }

  nestItem(record[realKey.toString()] as LegacyKeyStructure, key, value, idx + 1);
  return record;
};

export const transformTechRecord = (record: DynamoDBRecord) => {
  const vehicle = {} as LegacyTechRecord;

  vehicle.techRecord = [];

  const legacyRecord = {} as LegacyKeyStructure;

  if (record.dynamodb?.NewImage) {
    const NewImage: NewKeyStructure = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    for (const [key, value] of Object.entries(NewImage)) {
      if (key.indexOf('_') === -1 && !vehicle[key.toString()]) {
        vehicle[key.toString()] = value;
        continue;
      }
      nestItem(legacyRecord, key, value, 0);
    }

    // We don't want the createdTimestamp range key of the new data structure being put into the legacy data structure
    delete vehicle.createdTimestamp;

    vehicle.techRecord.push(legacyRecord.techRecord as LegacyKeyStructure);

    record.dynamodb.NewImage = (DynamoDB.Converter.marshall(vehicle) as { [key: string]: AttributeValue; });
  }
};
