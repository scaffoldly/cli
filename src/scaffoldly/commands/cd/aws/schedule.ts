import { Commands, ScaffoldlyConfig, Schedule } from '../../../../config';
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
  // eslint-disable-next-line import/named
  FlexibleTimeWindow,
  GetScheduleGroupCommand,
  // eslint-disable-next-line import/named
  GetScheduleGroupCommandOutput,
  ListSchedulesCommand,
  // eslint-disable-next-line import/named
  ListSchedulesCommandOutput,
  SchedulerClient,
  UpdateScheduleCommand,
} from '@aws-sdk/client-scheduler';
import { CloudResource, ResourceOptions } from '..';
import { DeployStatus } from '.';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

export type ScheduleStatus = {
  scheduleGroup?: string;
};

export type ScheduleGroup = {
  scheduleGroup: string;
};

// export type ScheduleGroupResource = CloudResource<
//   SchedulerClient,
//   ScheduleGroup,
//   CreateScheduleGroupCommand,
//   undefined,
//   undefined
// >;

export type ScheduledEvent = {
  scheduleName: string;
  scheduleGroup: string;
};

// export type ScheduleEventResource = CloudResource<
//   SchedulerClient,
//   ScheduledEvent,
//   CreateScheduleCommand,
//   UpdateScheduleCommand,
//   DeleteScheduleCommand
// >;

type InvokeOutput = {
  commands?: Commands;
  body?: string;
  failed?: boolean;
};

// export type InvokeFunctionResource = CloudResource<
//   LambdaClient,
//   InvokeOutput,
//   InvokeCommand,
//   undefined,
//   undefined
// >;

const sanitizeSchedule = (schedule: Schedule): string => {
  return schedule.replace('@', '');
};

const scheduleExpression = (schedule: Schedule): string => {
  switch (schedule) {
    case '@frequently':
      return 'rate(5 minutes)';
    case '@hourly':
      return 'rate(1 hour)';
    case '@daily':
      return 'rate(1 day)';
    default:
      throw new Error(`Invalid schedule: ${schedule}`);
  }
};

const flexibleTimeWindow = (schedule: Schedule): FlexibleTimeWindow => {
  switch (schedule) {
    case '@frequently':
      return { Mode: 'FLEXIBLE', MaximumWindowInMinutes: 5 };
    default:
      return { Mode: 'OFF' };
  }
};

const mapSchedules = (config: ScaffoldlyConfig): { [key in Schedule]: Commands } => {
  const { serveCommands } = config;
  return serveCommands.commands.reduce(
    (acc, command) => {
      const { schedule } = command;
      if (!schedule) {
        return acc;
      }

      acc[schedule].commands.push(command);

      return acc;
    },
    {
      '@immediately': new Commands(),
      '@daily': new Commands(),
      '@hourly': new Commands(),
      '@frequently': new Commands(),
    },
  );
};

export class ScheduleService implements IamConsumer {
  schedulerClient: SchedulerClient;

  lambdaClient: LambdaClient;

  constructor(private config: ScaffoldlyConfig) {
    this.schedulerClient = new SchedulerClient();
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const scheduleStatus: ScheduleStatus = {};

    const { scheduleGroup } = await new CloudResource<
      { scheduleGroup: string },
      GetScheduleGroupCommandOutput
    >(
      {
        describe: (resource) => `Schedule Group: ${resource.scheduleGroup}`,
        read: () =>
          this.schedulerClient.send(new GetScheduleGroupCommand({ Name: this.config.name })),
        create: () =>
          this.schedulerClient.send(new CreateScheduleGroupCommand({ Name: this.config.name })),
      },
      (existing) => {
        return { scheduleGroup: existing.Name };
      },
    ).manage(options);

    scheduleStatus.scheduleGroup = scheduleGroup;

    return { ...status, ...scheduleStatus };
  }

  public async deploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const schedules = mapSchedules(this.config);
    const desiredSchedules = Object.entries(schedules).filter(
      ([schedule, commands]) => schedule !== '@immediately' && !commands.isEmpty(),
    );

    // const undesiredSchedules = Object.entries(schedules).filter(
    //   ([schedule, commands]) => schedule !== '@immediately' && commands.isEmpty(),
    // );

    await new CloudResource<{ schedules: string[] }, ListSchedulesCommandOutput>(
      {
        describe: (resources) => `Schedules: ${resources.schedules?.join(', ')}`,
        read: () =>
          this.schedulerClient.send(new ListSchedulesCommand({ GroupName: status.scheduleGroup })),
        update: () =>
          Promise.all(
            desiredSchedules.map(([schedule, commands]) =>
              this.schedulerClient
                .send(
                  new UpdateScheduleCommand({
                    Name: sanitizeSchedule(schedule as Schedule),
                    GroupName: status.scheduleGroup,
                    State: 'ENABLED',
                    ScheduleExpression: scheduleExpression(schedule as Schedule),
                    ScheduleExpressionTimezone: 'UTC',
                    ActionAfterCompletion: 'NONE',
                    Target: {
                      Arn: status.functionArn,
                      RoleArn: status.roleArn,
                      Input: JSON.stringify(commands.encode()),
                    },
                    FlexibleTimeWindow: flexibleTimeWindow(schedule as Schedule),
                  }),
                )
                .catch(() =>
                  this.schedulerClient.send(
                    new CreateScheduleCommand({
                      Name: sanitizeSchedule(schedule as Schedule),
                      GroupName: status.scheduleGroup,
                      State: 'ENABLED',
                      ScheduleExpression: scheduleExpression(schedule as Schedule),
                      ScheduleExpressionTimezone: 'UTC',
                      ActionAfterCompletion: 'NONE',
                      Target: {
                        Arn: status.functionArn,
                        RoleArn: status.roleArn,
                        Input: JSON.stringify(commands.encode()),
                      },
                      FlexibleTimeWindow: flexibleTimeWindow(schedule as Schedule),
                    }),
                  ),
                ),
            ),
          ),
      },
      (existing) => {
        return {
          schedules: (existing.Schedules || [])
            .filter((s) => !!s.Name)
            .map((s) => s.Name) as string[],
        };
      },
    ).manage(options);

    // const { scheduleGroup } = await manageResource(
    //   this.scheduleGroupResource(this.config.name),
    //   options,
    // );

    // if (!scheduleGroup) {
    //   throw new Error('Missing scheduleGroup');
    // }

    // const { functionArn, roleArn } = status;
    // if (!functionArn) {
    //   throw new Error('Missing functionArn');
    // }

    // if (!roleArn) {
    //   throw new Error('Missing roleArn');
    // }

    // await Promise.all(
    //   Object.entries(mapSchedules(this.config)).map(async ([schedule, commands]) => {
    //     if (schedule === '@immediately') {
    //       return manageResource(
    //         this.invokeFunctionResource(this.config.name, commands),
    //         options,
    //       ).then((output) => {
    //         if (commands.isEmpty({ schedule })) {
    //           return;
    //         }
    //         ui.updateBottomBar('');
    //         const emoji = output.failed === true ? '❌' : '✅';
    //         console.log(`\n${emoji} Executed \`${commands.toString({ schedule })}\``);
    //         if (output.body) {
    //           console.log(`   --> ${output.body.trim().replace('\n', '\n   -->')}`);
    //         }
    //       });
    //     }

    //     return manageResource(
    //       this.scheduleCommandResource(
    //         scheduleGroup,
    //         schedule as Schedule,
    //         commands,
    //         functionArn,
    //         roleArn,
    //       ),
    //       options,
    //     ).then(() => {
    //       ui.updateBottomBar('');
    //       const command = commands.toString({ schedule: schedule as Schedule });
    //       if (!command) return;
    //       console.log(
    //         `\n✅ Scheduled \`${command}\` for ${scheduleExpression(schedule as Schedule)}`,
    //       );
    //     });
    //   }),
    // );

    return { ...status };
  }

  // private scheduleGroupResource(name: string): ScheduleGroupResource {
  //   const read = async () => {
  //     return this.schedulerClient
  //       .send(new GetScheduleGroupCommand({ Name: name }))
  //       .then((response) => {
  //         if (!response.Name) {
  //           throw new NotFoundException('Schedule Group not found');
  //         }
  //         return {
  //           scheduleGroup: response.Name,
  //         } as ScheduleGroup;
  //       })
  //       .catch((e) => {
  //         if (e.name === 'NotFoundException') {
  //           throw new NotFoundException('Schedule Group not found', e);
  //         }
  //         throw e;
  //       });
  //   };

  //   return {
  //     client: this.schedulerClient,
  //     read,
  //     create: (command) => this.schedulerClient.send(command).then(read),
  //     update: () => read(),
  //     request: {
  //       create: new CreateScheduleGroupCommand({
  //         Name: name,
  //       }),
  //     },
  //   };
  // }

  // private scheduleCommandResource(
  //   group: string,
  //   schedule: Schedule,
  //   commands: Commands,
  //   functionArn: string,
  //   roleArn: string,
  // ): ScheduleEventResource {
  //   const name = sanitizeSchedule(schedule);

  //   const read = async () => {
  //     return this.schedulerClient
  //       .send(new GetScheduleCommand({ Name: name, GroupName: group }))
  //       .then((response) => {
  //         const { Name, GroupName } = response;
  //         if (!Name || !GroupName) {
  //           throw new NotFoundException('Schedule not found');
  //         }
  //         return {
  //           scheduleName: Name,
  //           scheduleGroup: GroupName,
  //         } as ScheduledEvent;
  //       })
  //       .catch((e) => {
  //         if (e.name === 'NotFoundException') {
  //           throw new NotFoundException('Schedule not found', e);
  //         }
  //         throw e;
  //       });
  //   };

  // const target: Target = ;

  //   const flexibleTimeWindow: FlexibleTimeWindow =
  //     schedule === '@frequently'
  //       ? { Mode: 'FLEXIBLE', MaximumWindowInMinutes: 5 }
  //       : { Mode: 'OFF' };

  //   return {
  //     client: this.schedulerClient,
  //     read,
  //     create: (command) => this.schedulerClient.send(command).then(read),
  //     update: (command) => this.schedulerClient.send(command).then(read),
  //     dispose: (resource, command) => this.schedulerClient.send(command).then(() => resource),
  //     disposable: Promise.resolve(
  //       this.config.serveCommands.commands.every((c) => c.schedule !== schedule),
  //     ),
  //     request: {
  //       create: new CreateScheduleCommand({

  //       }),
  //       update: new UpdateScheduleCommand({
  //         Name: name,
  //         GroupName: group,
  //         State: 'ENABLED',
  //         ScheduleExpression: scheduleExpression(schedule),
  //         ScheduleExpressionTimezone: 'UTC',
  //         ActionAfterCompletion: 'NONE',
  //         Target: target,
  //         FlexibleTimeWindow: flexibleTimeWindow,
  //       }),
  //       dispose: new DeleteScheduleCommand({
  //         Name: name,
  //         GroupName: group,
  //       }),
  //     },
  //   };
  // }

  // private invokeFunctionResource(name: string, commands: Commands): InvokeFunctionResource {
  //   return {
  //     client: this.lambdaClient,
  //     read: () => {
  //       throw new NotFoundException('Not implemented');
  //     },
  //     create: async (command) => {
  //       const invokeOutput: InvokeOutput = { commands: commands };

  //       if (commands.isEmpty()) {
  //         return invokeOutput;
  //       }

  //       return this.lambdaClient.send(command).then((response) => {
  //         const { Payload } = response;
  //         if (!Payload) {
  //           return invokeOutput;
  //         }

  //         const payload = JSON.parse(Buffer.from(Payload).toString('utf-8'));
  //         if ('statusCode' in payload && payload.statusCode !== 200) {
  //           invokeOutput.failed = true;
  //         }

  //         if ('body' in payload && typeof payload.body === 'string') {
  //           invokeOutput.body = JSON.parse(payload.body);
  //         } else {
  //           invokeOutput.body = JSON.stringify(payload);
  //         }

  //         return invokeOutput;
  //       });
  //     },
  //     update: () => {
  //       throw new NotFoundException('Not implemented');
  //     },
  //     request: {
  //       create: new InvokeCommand({
  //         FunctionName: name,
  //         InvocationType: 'RequestResponse',
  //         Payload: JSON.stringify(commands.encode()),
  //       }),
  //     },
  //   };
  // }

  get trustRelationship(): TrustRelationship {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'scheduler.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    };
  }

  get policyDocument(): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['lambda:InvokeFunction'],
          Effect: 'Allow',
          Resource: [`arn:*:lambda:*:*:function:${this.config.name}*`],
        },
      ],
    };
  }
}
