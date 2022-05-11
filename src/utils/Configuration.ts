import SQS from 'aws-sdk/clients/sqs';
import { readSync } from 'node-yaml';
import { TargetConfig } from '../models';

interface MarshallerConfig {
  sqs: {
    local: {
      params: SQS.ClientConfiguration;
      queueName: [];
    },
    remote: {
      params: SQS.ClientConfiguration;
      queueName: [];
    }
  },
  targets: {
    activities: {
      queueName: string;
    },
    'test-results': {
      queueName: string;
    },
    'technical-records': {
      queueName: string;
    }
  }
}

/**
 * Helper class for retrieving project configuration
 */
class Configuration {
  private static instance: Configuration;

  private readonly config: MarshallerConfig;

  private constructor(configPath: string) {
    const config = readSync(configPath);

    // Replace environment variable references
    let stringifiedConfig: string = JSON.stringify(config);
    const envRegex = /\${(\w+\b):?(\w+\b)?}/g;
    const matches: RegExpMatchArray | null = stringifiedConfig.match(envRegex);

    if (matches) {
      matches.forEach((match: string) => {
        envRegex.lastIndex = 0;
        const captureGroups: RegExpExecArray = envRegex.exec(match) as RegExpExecArray;

        // Insert the environment variable if available. If not, insert placeholder. If no placeholder, leave it as is.
        stringifiedConfig = stringifiedConfig.replace(match, process.env[captureGroups[1]] || captureGroups[2] || captureGroups[1]);
      });
    }

    this.config = JSON.parse(stringifiedConfig) as MarshallerConfig;
  }

  /**
   * Retrieves the singleton instance of Configuration
   * @returns Configuration
   */
  public static getInstance(): Configuration {
    if (!this.instance) {
      this.instance = new Configuration('../config/config.yml');
    }

    return Configuration.instance;
  }

  /**
   * Retrieves the entire config as an object
   * @returns any
   */
  public getConfig(): MarshallerConfig {
    return this.config;
  }

  public getTargets(): TargetConfig {
    return this.config.targets;
  }
}

export {
  Configuration,
  MarshallerConfig,
};
