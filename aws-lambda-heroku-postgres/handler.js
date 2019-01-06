// handler.js
'use strict';

const express = require('express');
const serverless = require('serverless-http');
const pg = require('pg');
const axios = require('axios');
const parsePgConnStr = require('pg-connection-string').parse;

const herokuApiKey = '59e05537-4b95-4818-aa86-63f07939fd9c';
const herokuPostgresId = 'postgresql-slippery-72122';
const herokuClient = axios.create({
    baseURL: 'https://api.heroku.com/',
    headers: {
        'Authorization': `Bearer ${herokuApiKey}`,
        'Accept': 'application/vnd.heroku+json; version=3',
    },
});

let pgPool;

const app = express();

const createConn = async () => {
    console.log('Creating PG connection.');

    const credsResponse = await herokuClient.get(`addons/${herokuPostgresId}/config`);
    const pgConnStr = credsResponse.data[0]['value'];

    const pgConfig = {
        ...parsePgConnStr(pgConnStr), ...{
            max: 1,
            ssl: true,
        },
    };

    pgPool = new pg.Pool(pgConfig);
};

const performQuery = async () => {
    const client = await pgPool.connect();
    const result = await client.query('SELECT now()');
    client.release();
    return result;
};

app.get('/hello', async function (req, res) {
    if (!pgPool) {
        await createConn();
    } else {
        console.log('Using existing PG connection.');
    }

    try {
        const result = await performQuery();

        res.json({
            result: `Hello, World! According to PostgreSQL, the time is: ${result.rows[0].now}`,
        });
        return;
    } catch (e) {
        if (e.routine !== undefined && e.routine === 'auth_failed') {
            // known possible 1st failure... refresh creds and try again
            await createConn();
            const result = await performQuery();

            res.json({
                result: `Hello, World! According to PostgreSQL, the time is: ${result.rows[0].now}`,
            });
            return;
        } else {
            res.json({
                error: e.message,
            });
            return;
        }
    }
});

module.exports = {
    app,
    hello: serverless(app),
};
