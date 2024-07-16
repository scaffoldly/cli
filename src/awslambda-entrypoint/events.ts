import { log } from './log';
import { EndpointProxyRequest } from './types';
import { endpointProxy } from './endpoints';
import { getRuntimeEvent, postRuntimeEventResponse } from './runtime';
import { Routes } from '../config';

export const pollForEvents = async (
  runtimeApi: string,
  handler: string,
  routes?: Routes,
): Promise<void> => {
  log('Waiting for next event from Lambda Runtime API', { runtimeApi });

  const { requestId, event, deadline } = await getRuntimeEvent(runtimeApi);

  log('Proxying request', { handler });

  const request: EndpointProxyRequest = {
    requestId,
    routes,
    handler,
    event,
    deadline,
  };

  const payload = (await endpointProxy(request)).payload;
  await postRuntimeEventResponse(runtimeApi, requestId, payload);

  log('Response sent to Lambda Runtime API', { runtimeApi, requestId });

  return pollForEvents(runtimeApi, handler);
};
