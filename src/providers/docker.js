const Docker = require('dockerode');
const promisify = require('../utils/promisify');

exports.getClient = options => new Docker(options);

const call = (client, key) => promisify(client[key].bind(client));

exports.list = client => call(client, 'listContainers')({all: true});

exports.start = (
  client,
  {
    command,
    image,
    env = {},
    labels: Labels = {},
    volumesFrom: VolumesFrom = []
  }
) =>
  new Promise((resolve, reject) =>
    client.run(image, command, null, {
      Env: Object.keys(env).map(key => `${key}=${env[key]}`),
      Labels,
      VolumesFrom
    }, er => {
      if (er) reject(er);
    }).on('start', ({id}) => resolve(id))
  );

exports.stop = (client, {id}) => call(client.getContainer(id), 'stop');

exports.remove = (client, {id}) => call(client.getContainer(id), 'remove');
