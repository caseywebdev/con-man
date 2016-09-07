const Docker = require('dockerode');
const promisify = require('../utils/promisify');

exports.getClient = options => new Docker(options);

const call = (client, key, ...args) =>
  promisify(client[key].bind(client))(...args);

exports.list = client => call(client, 'listContainers', {all: true});

const normalizeConfig = config =>
  Object.assign({}, config, {
    Cmd: config.command,
    command: undefined,
    Env: Object.keys(config.env || {}).map(key =>
      `${key}=${config.env[key] == null ? '' : config.env[key]}`
    ),
    env: undefined,
    Image: config.image,
    image: undefined
  });

const mergeConfig = (a, b) =>
  Object.assign({}, a, {
    Cmd: b.Cmd || a.Cmd,
    Env: a.Env.concat(b.Env),
    Image: b.Image || a.Image,
    Labels: Object.assign({}, a.Labels, b.Labels)
  });

const getConfig = (client, config) => {
  const {clone} = config;

  if (!clone) return Promise.resolve(config);

  return call(client.getContainer(clone), 'inspect').then(info =>
    mergeConfig(
      Object.assign({}, info.Config, {HostConfig: info.HostConfig}),
      config
    )
  );
};

exports.start = (client, config) =>
  getConfig(client, normalizeConfig(config))
    .then(config => call(client, 'createContainer', config))
    .then(container => call(container, 'start').then(() => container.id));

exports.stop = (client, {id}) => call(client.getContainer(id), 'stop');

exports.remove = (client, {id}) => call(client.getContainer(id), 'remove');
