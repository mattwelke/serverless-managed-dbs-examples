'use strict';

const pg = require('pg');

const axios = require('axios');
const parsePgConnStr = require('pg-connection-string').parse;

// Heroku API key hard-coded for easy development.
// INSECURE - CHANGE FOR PROD
const herokuApiKey = 'REDACTED';
const herokuPostgresId = 'postgresql-silhouetted-50650';
const herokuApi = axios.create({
  baseURL: 'https://api.heroku.com/',
  headers: {
    'Authorization': `Bearer ${herokuApiKey}`,
    'Accept': 'application/vnd.heroku+json; version=3',
  },
});

// Pool will be reused for each invocation of the backing container.
let pgPool;

const setupPgPool = async () => {
  const herokuRes = await herokuApi.get(`addons/${herokuPostgresId}/config`);
  const pgConnStr = herokuRes.data[0].value;

  // Use connection string from Heroku API response as a base. Overwrite "max"
  // and "ssl".
  const pgConfig = {
    ...parsePgConnStr(pgConnStr),
    ...{
      max: 1,
      ssl: true,
    },
  };

  pgPool = new pg.Pool(pgConfig);
};

module.exports.hello = async () => {
  if (!pgPool) {
    // "Cold start". Get Heroku Postgres creds and create connection pool.
    await setupPgPool();
  }
  // Else, backing container "warm". Use existing connection pool.

  try {
    const result = await pgPool.query('SELECT now()');

    // Response body must be JSON.
    return {
      statusCode: 200,
      body: JSON.stringify({
        output: {
          currTimePg: result.rows[0].now,
        },
      }),
    };
  } catch (e) {
    // Return error message in response body for easy debugging.
    // INSECURE - CHANGE FOR PROD
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: e.message,
      }),
    };
  }
};