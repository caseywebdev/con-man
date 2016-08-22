const PROVIDERS = {
  docker: require('./providers/docker'),
  ecs: require('./providers/ecs')
};

[
  'list',
  'start',
  'stop'
].forEach(key =>
  exports[key] = (options = {}) =>
    new Promise(resolve => {
      const {provider: {name} = {}, provider: pOptions} = options;
      if (!name) throw new Error('A provider is required');

      const provider = PROVIDERS[name];
      if (!provider) throw new Error(`Unknown provider "${name}"`);

      resolve(provider[key](provider.getClient(pOptions), options));
    })
);
