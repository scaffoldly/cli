import { ScaffoldlyConfig, SecretConsumer } from '../../../../config';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';
import { ui } from '../../../command';

export type SecretName = string;
export type SecretVersion = string;

export type SecretDeployStatus = {
  secretName?: SecretName;
};

export type SecretResource = CloudResource<
  SecretsManagerClient,
  SecretName,
  CreateSecretCommand,
  UpdateSecretCommand
>;

export class SecretService {
  secretsManagerClient: SecretsManagerClient;

  constructor(private config: ScaffoldlyConfig) {
    this.secretsManagerClient = new SecretsManagerClient();
  }

  public async deploy(
    _status: DeployStatus,
    consumer: SecretConsumer,
    options: ResourceOptions,
  ): Promise<SecretDeployStatus> {
    const secretStatus: SecretDeployStatus = {};

    ui.updateBottomBar('Deploying Secret');
    const { secretName } = await this.manageSecret(consumer.secretValue, options);

    secretStatus.secretName = secretName;

    return secretStatus;
  }

  private async manageSecret(
    value: Uint8Array,
    options: ResourceOptions,
  ): Promise<{ secretName: string }> {
    const { name } = this.config;
    if (!name) {
      throw new Error('Missing name');
    }

    const secretName = await manageResource(this.secretResource(name, value), options);

    return { secretName };
  }

  private secretResource(name: string, value: Uint8Array): SecretResource {
    // const secretHash = Buffer.from(value).toString('base64');

    const read = async () => {
      return this.secretsManagerClient
        .send(new DescribeSecretCommand({ SecretId: name }))
        .then((response) => {
          if (!response.Name) {
            throw new NotFoundException('Secret not found');
          }
          // TODO: Check consistency of the secret's value?
          return response.Name;
        });
    };

    return {
      client: this.secretsManagerClient,
      read,
      create: (command) => {
        console.log('Creating secret', command);
        return this.secretsManagerClient.send(command).then(read);
      },
      update: (command) => {
        console.log('Updating secret', command);
        return this.secretsManagerClient.send(command).then(read);
      },
      request: {
        create: new CreateSecretCommand({
          Name: name,
          SecretBinary: value,
        }),
        update: new UpdateSecretCommand({
          SecretId: name,
          SecretBinary: value,
        }),
      },
    };
  }
}