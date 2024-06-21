import Docker from 'dockerode';
import tar, { Pack } from 'tar-fs';
import { writeFileSync } from 'fs';
import { Entrypoint, ScaffoldlyConfig } from './config';
import { base58 } from '@scure/base';
import { join } from 'path';

type Path = string;

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

export class DockerService {
  docker: Docker;

  constructor(private cwd: string) {
    this.docker = new Docker();
  }

  async build(config: ScaffoldlyConfig, mode: Entrypoint) {
    const { spec } = await this.createSpec(config, mode);

    const { files = [] } = config;

    // todo add dockerfile to tar
    // const dockerfile =
    this.render(spec, mode);

    const stream = tar.pack(this.cwd, {
      filter: (path) => {
        return files.includes(path);
      },
    });

    // console.log('!!! dockerfile', dockerfile);

    const buildStream = await this.docker.buildImage(stream, {
      // dockerfile,
      t: config.name,
    });

    const stuffs = await new Promise<any[]>((resolve, reject) => {
      this.docker.modem.followProgress(
        buildStream,
        (err, res) => {
          err ? reject(err) : resolve(res);
        },
        (event) => {
          console.log('!!! event', event);
        },
      );
    });

    console.log('!!! stuffs', stuffs);
  }

  async createSpec(
    config: ScaffoldlyConfig,
    mode: Entrypoint,
  ): Promise<{ spec: DockerFileSpec; stream?: Pack }> {
    const workdir = '/app';
    const builder = 'builder';

    const { runtime } = config;

    if (!runtime) {
      throw new Error('Missing runtime');
    }

    let spec: DockerFileSpec = {
      from: runtime,
      workdir: workdir,
      copy: [],
      env: {
        _HANDLER: `base58:${base58.encode(new TextEncoder().encode(JSON.stringify(config)))}`,
      },
      entrypoint: '/bin/bootstrap', // TODO How to get this installed
    };

    if (mode === 'develop') {
      const { files = [] } = config;
      spec.copy = files;
    }

    if (mode === 'build' || mode === 'serve') {
      const { build } = config.entrypoints || {};
      const { files = [], devFiles = [] } = config;
      if (!build) {
        throw new Error('Missing build entrypoint');
      }

      spec.base = {
        ...spec,
        copy: devFiles,
        as: builder,
        run: [build],
      };

      spec.copyFrom = files.map((file) => ({
        from: builder,
        src: file,
      }));
    }

    if (!spec) {
      throw new Error('No Dockerfile generated');
    }

    return { spec };
  }

  render = (spec: DockerFileSpec, mode: Entrypoint): Path => {
    const lines = [];

    if (spec.base) {
      lines.push(this.render(spec.base, mode));
    }

    const { copy, copyFrom, workdir, env, entrypoint } = spec;

    const from = spec.as ? `${spec.from} as ${spec.as}` : spec.from;

    lines.push('#');
    lines.push('# DO NOT EDIT THIS FILE. IT WAS GENERATED BY SCAFFOLDLY');
    lines.push('#');

    lines.push(`FROM ${from}`);
    lines.push(`ENTRYPOINT ${entrypoint}`);
    lines.push(`WORKDIR ${workdir}`);

    for (const [key, value] of Object.entries(env)) {
      lines.push(`ENV ${key}="${value}"`);
    }

    if (copy) {
      lines.push(`COPY ${copy.map((file) => file.replace(this.cwd, './')).join(' ')}* .`);
    }

    if (copyFrom) {
      for (const cf of copyFrom) {
        lines.push(`COPY --from=${cf.from} ${cf.src.replace(this.cwd, `${workdir}/`)} .`);
      }
    }

    const dockerfile = lines.join('\n');

    const path = join(this.cwd, 'Dockerfile') as Path;

    writeFileSync(path, Buffer.from(dockerfile, 'utf-8'));

    return path;
  };
}
