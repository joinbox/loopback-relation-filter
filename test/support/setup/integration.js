const InitMicroService = require('./unit');

function migrateDatasource(datasource) {
    return new Promise((resolve, reject) => {
        datasource.automigrate((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = function({ env = process.env.NODE_ENV } = {}) {

  InitMicroService({env});

  before('clean up database and migrate models', function() {
    const datasources = this.service.app.datasources;
    const sources = new Set();

    const pendingMigrations = Object
    .keys(datasources)
    .reduce((promises, datasourceName) => {
      const currentSource = datasources[datasourceName];
      if (!sources.has(currentSource)) {
        sources.add(currentSource);
        promises.push(migrateDatasource(currentSource));
      }
      return promises;
    }, []);

    return Promise.all(pendingMigrations);
  });

  before('start service', async function() {
    await this.service.start();
    this.apiClient = this.service.api;
  });

  after('stop service', async function() {
    await this.service.stop();
  });

}
