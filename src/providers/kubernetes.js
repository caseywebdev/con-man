const _ = require('underscore');
const {api} = require('k8s');
const assert = require('assert');

const TEN_SECONDS = 1000 * 10;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  client.delete(`namespaces/${namespace}/pods/${id}`, {gracePeriodSeconds});

const remove = exports.remove = (client, {namespace, id}) =>
  client.get(`namespaces/${namespace}/pods/${id}`).then(
    ({
      metadata: {deletionTimestamp},
      spec: {terminationGracePeriodSeconds}
    }) => {
      let promise = Promise.resolve();

      // If the pod hasn't been scheduled to terminate yet, do that first.
      if (!deletionTimestamp) promise = stop(client, {namespace, id});
      else {
        const delta = (_.now() - new Date(deletionTimestamp)) / 1000;

        // If the pod is terminating check to see if it is still within its
        // grace period. If so, wait and try again.
        if (delta < terminationGracePeriodSeconds) promise = wait(TEN_SECONDS);

        // Otherwise forcefully kill the pod as it may be indefinitely stuck in
        // the terminating state.
        else promise = stop(client, {namespace, id, gracePeriodSeconds: 0});
      }

      return promise.then(() => remove(client, {namespace, id}));
    },
    er => {
      try { assert.equal(JSON.parse(er).code, 404); } catch (__) { throw er; }
    }
  );
