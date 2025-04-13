const { PostgreSqlContainer } = require("@testcontainers/postgresql");

module.exports = async function (globalConfig, projectConfig) {
  const POSTGRES_DB = "pastorino";
  const POSTGRES_USER = "pastorino";
  const POSTGRES_PASSWORD = "pastorino";
  const POSTGRES_PORT = 5432;

  const dbContainer = await new PostgreSqlContainer()
    .withUsername(POSTGRES_USER)
    .withPassword(POSTGRES_PASSWORD)
    .withDatabase(POSTGRES_DB)
    .withExposedPorts(POSTGRES_PORT)
    .start();

  global.__POSTGRES__ = dbContainer;
};
