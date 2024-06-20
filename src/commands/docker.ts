import Docker from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { Entrypoint, ScaffoldlyConfig } from './config';

type Dockerfile = string;

type DockerFileSpec = {
  base?: DockerFileSpec;
  from: string;
  as?: string;
  workdir: string;
  copy?: string[];
  copyFrom?: {
    from: string;
    src: string;
  }[];
  env: { [key: string]: string };
  run?: string[];
  entrypoint: string;
};

export const render = (spec: DockerFileSpec): Dockerfile => {
  const lines = [];

  if (spec.base) {
    lines.push(render(spec.base));
  }

  const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

  lines.push(`FROM ${from}`);
  lines.push(`WORKDIR ${spec.workdir}`);

  const { copy, copyFrom, workdir, env, entrypoint } = spec;

  if (copy) {
    lines.push(`COPY ${copy.join(' ')} .`);
  }

  if (copyFrom) {
    for (const cf of copyFrom) {
      lines.push(`COPY --from=${cf.from} ${cf.src} ${workdir}`);
    }
  }

  for (const [key, value] of Object.entries(env)) {
    lines.push(`ENV ${key}=${value}`);
  }

  lines.push(`ENTRYPOINT ${entrypoint}`);

  return lines.join('\n');
};

export class DockerService {
  docker: Docker;

  constructor(private cwd: string) {
    this.docker = new Docker();
  }

  async build(config: ScaffoldlyConfig, entrypoint: Entrypoint) {
    const { spec, stream } = await this.createSpec(config, entrypoint);

    const dockerfile = render(spec);

    console.log(`!!! ****dockerfile****\n\n${dockerfile}\n\n*****end*****`);

    const buildStream = await this.docker.buildImage(stream, {
      dockerfile,
      t: config.name,
    });

    const stuffs = await new Promise<any[]>((resolve, reject) => {
      this.docker.modem.followProgress(buildStream, (err, res) => {
        console.log('!!! followProgress', { err, res });
        err ? reject(err) : resolve(res);
      });
    });

    console.log('!!! stuffs', stuffs);
  }

  async createSpec(
    config: ScaffoldlyConfig,
    entrypoint: Entrypoint,
  ): Promise<{ spec: DockerFileSpec; stream: Pack }> {
    const workdir = '/app';
    const { route, runtime } = config;

    if (!route) {
      throw new Error('Missing route');
    }

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    const handler = route.replace('/{proxy+}', '');

    let spec: DockerFileSpec = {
      from: runtime,
      workdir: workdir,
      copy: [],
      env: {
        _HANDLER: handler,
      },
      entrypoint: '/bin/bootstrap', // TODO How to get this installed
    };

    if (entrypoint === 'develop') {
      spec.copy = ['.'];
    }

    if (entrypoint === 'build' || entrypoint === 'serve') {
      const { build } = config.entrypoints || {};
      const { files = [] } = config;
      if (!build) {
        throw new Error('Missing build entrypoint');
      }

      spec.base = {
        ...spec,
        as: 'builder',
        run: [build],
      };

      spec.copyFrom = files.map((file) => ({
        from: 'builder',
        src: file,
      }));
    }

    if (!spec) {
      throw new Error('No Dockerfile generated');
    }

    const stream = tar.pack(this.cwd, {
      filter: (path) => {
        console.log('!!! evaluating path', path);
        return false;
      },
    });

    return { spec, stream };
  }
}
