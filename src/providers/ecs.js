const {ECS} = require('aws-sdk');

exports.getClient = options => new ECS(options);

exports.list = (client, {cluster} = {}, {tasks = [], nextToken} = {}) =>
  client.listTasks({cluster, nextToken}).promise()
    .then(({taskArns, nextToken}) => {
      if (!taskArns.length) return tasks;

      return client.describeTasks({cluster, tasks: taskArns}).promise()
        .then(({tasks: _tasks}) => {
          tasks.push.apply(tasks, _tasks);

          if (!nextToken) return tasks;

          return exports.list(client, {cluster}, {tasks, nextToken});
        }
      );
    });

const updateContainerDefinition = ({containerDefinition, image}) => {
  const [repoA] = image.split(':');
  const [repoB] = containerDefinition.image.split(':');
  if (repoA !== repoB) return containerDefinition;

  return Object.assign({}, containerDefinition, {image});
};

const updateContainerDefinitions = ({containerDefinitions, image}) => {
  const updated = containerDefinitions.slice();
  let didUpdate = false;
  for (let i = 0, l = containerDefinitions.length; i < l; ++i) {
    const containerDefinition = containerDefinitions[i];
    updated.push(updateContainerDefinition({containerDefinition, image}));
    if (updated[i] !== containerDefinition) didUpdate = true;
  }

  return didUpdate ? updated : containerDefinitions;
};

const updateTaskDefinitionImage = ({taskDefinition, image}) => {
  const {containerDefinitions} = taskDefinition;
  const updated = updateContainerDefinitions({containerDefinitions, image});
  if (updated === containerDefinitions) return taskDefinition;

  return Object.assign({}, taskDefinition, {containerDefinitions: updated});
};

const updateTaskDefinition = ({client, taskDefinition, image}) => {
  const updated = updateTaskDefinitionImage({taskDefinition, image});
  if (updated === taskDefinition) return taskDefinition;

  return client.registerTaskDefinition(updated).promise()
    .then(({taskDefinition}) => taskDefinition);
};

const getContainerName = ({taskDefinition, image}) => {
  const {containerDefinitions, family} = taskDefinition;

  for (let i = 0, l = containerDefinitions.length; i < l; ++i) {
    const containerDefinition = containerDefinitions[i];
    if (containerDefinition.image === image) return containerDefinition.name;
  }

  throw new Error(`Cannot find image ${image} in ${family}`);
};

exports.start = (
  client,
  {
    cluster,
    taskDefinition,
    image,
    startedBy,
    command,
    env = {}
  }
) =>
  client.describeTaskDefinition({taskDefinition}).promise()
    .then(({taskDefinition}) =>
      updateTaskDefinition({client, taskDefinition, image})
    )
    .then(taskDefinition =>
      client.runTask({
        cluster,
        taskDefinition: taskDefinition.taskDefinitionArn,
        startedBy,
        overrides: {
          containerOverrides: [{
            name: getContainerName({taskDefinition, image}),
            command,
            environment: Object.keys(env).map(name => ({
              name,

              // ECS will complain if the envvar value isn't a string.
              value: `${env[name] == null ? '' : env[name]}`
            }))
          }]
        }
      }).promise()
    )
    .then(({tasks: {0: {taskArn}}}) => taskArn);

exports.stop = (client, {cluster, id}) =>
  client.stopTask({cluster, task: id}).promise();

exports.remove = () => Promise.resolve();
