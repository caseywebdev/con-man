const Docker = require('dockerode');
const promisify = require('../utils/promisify');

exports.getClient = options => new Docker(options);

const call = (client, key, ...args) =>
  promisify(client[key].bind(client))(...args);

exports.list = client => call(client, 'listContainers', {all: true});

const normalizeConfig = config => {
  const {clone, command: Cmd, env = {}, image: Image, labels: Labels = {}} =
    config;

  return {
    clone,
    Cmd,
    Env: Object.keys(env).map(key => `${key}=${env[key]}`),
    Image,
    Labels
  };
};

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
