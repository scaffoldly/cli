import { APIGatewayProxyResult } from 'aws-lambda';
import { ChildProcess } from 'child_process';
import { Commands, Routes } from '../config';

export type SpawnResult = {
  childProcess?: ChildProcess;
  handler: string;
};

export type RuntimeEvent = {
  requestId: string;
  event: string;
  deadline: number;
};

export type EndpointProxyRequest = {
  requestId: string;
  routes: Routes;
  commands: Commands;
  env: Record<string, string>;
  event: string;
  deadline: number;
};

export type EndpointResponse = {
  requestId: string;
  // TODO: support results to different invokers
  payload: APIGatewayProxyResult;
};
