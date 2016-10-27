const _ = require('underscore');
const {api} = require('k8s');
const assert = require('assert');

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

const stop = exports.stop = (client, {namespace, id, gracePeriodSeconds}) =>
  client.delete(`namespaces/${namespace}/pods/${id}`, {
    json: {gracePeriodSeconds}
  });

const remove = exports.remove = (client, {namespace, id}) =>
  client.get(`namespaces/${namespace}/pods/${id}`)
    .then(({
      metadata: {deletionTimestamp},
      spec: {terminationGracePeriodSeconds}
    }) => {
      if (!deletionTimestamp) return stop(client, {namespace, id});

      const delta = (_.now() - new Date(deletionTimestamp)) / 1000;
      const wait = () => new Promise(resolve => setTimeout(resolve, 1000 * 10));
      if (delta < terminationGracePeriodSeconds) return wait();

      return stop(client, {namespace, id, gracePeriodSeconds: 0}).then(wait);
    })
    .then(() => remove(client, {namespace, id}))
    .catch(er => {
      try { assert.equal(JSON.parse(er).code, 404); } catch (__) { throw er; }
    });
