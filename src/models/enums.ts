enum ERROR {
  NO_UNIQUE_TARGET = 'Unable to determine unique target',
  NO_SQS_CONFIG = 'SQS config is not defined in the config file.',
}

enum EventSource {
  TECHNICAL_RECORDS,
  TEST_RESULTS,
}

export { EventSource, ERROR };
