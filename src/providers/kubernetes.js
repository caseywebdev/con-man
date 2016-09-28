const _ = require('underscore');
const {api} = require('k8s');

exports.getClient = options => api(options);

exports.list = (client, {namespace} = {}) =>
  client.get(`namespaces/${namespace}/pods`).then(({items}) => items);

const envToArray = env =>
  Object.keys(env).map(name => ({
    name,
    value: `${env[name] == null ? '' : env[name]}`
  }));

exports.start = (client,
  {
    namespace,
    podTemplateName,
    image,
    labels,
    command,
    env = {}
  }
) =>
  client
    .get(`namespaces/${namespace}/podtemplates/${podTemplateName}`)
    .then(({template: {spec, spec: {containers: {0: container}}}}) =>
      client.post(`namespaces/${namespace}/pods`, {
        metadata: {generateName: 'con-man-', labels},
        spec: _.extend({}, spec, {
          containers: [_.extend({}, container, {
            image,
            command,
            env: container.env.concat(envToArray(env))
          })]
        })
      })
    ).then(({metadata: {name}}) => name);

exports.stop = (client, {namespace, id}) =>
  client.delete(`namespaces/${namespace}/pods/${id}`);

exports.remove = () => Promise.resolve();
