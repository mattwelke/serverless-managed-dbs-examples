// handler.js
'use strict';

const express = require('express');
const serverless = require('serverless-http');
const pg = require('pg');
const axios = require('axios');
const parsePgConnStr = require('pg-connection-string').parse;
const bodyParser = require('body-parser');
const _ = require('lodash');
const elasticsearch = require('elasticsearch');

const validatePost = require('./posts/validate');
const PostService = require('./posts/service');

// Credentials
const herokuApiKey = '8c9550ad-3b66-4b34-a688-c9f7b557549f';
const herokuPostgresId = 'postgresql-curved-40533';
const esHostUrl = 'https://avnadmin:dun1qruiaf0wit7n@es-f77f2ca-mattwelke-8776.aivencloud.com:21281';

// Connections - kept in memory while Lambda is warm.
let esClient;
let pgConfig;
let pgPool;

const app = express();
app.use(bodyParser.json());

const createPgPool = async () => {
    console.log('Creating PG connection.');

    const herokuClient = axios.create({
        baseURL: 'https://api.heroku.com/',
        headers: {
            'Authorization': `Bearer ${herokuApiKey}`,
            'Accept': 'application/vnd.heroku+json; version=3',
        },
    });
    const credsResponse = await herokuClient.get(`addons/${herokuPostgresId}/config`);
    const pgConnStr = credsResponse.data[0]['value'];

    pgConfig = {
        ...parsePgConnStr(pgConnStr), ...{
            max: 1,
            ssl: true,
        },
    };

    pgPool = new pg.Pool(pgConfig);
};

const createEsClient = async () => {
    esClient = new elasticsearch.Client({
        host: esHostUrl,
    });
};

app.post('/posts', async (req, res) => {
    const newPost = req.body;
    const errors = validatePost(newPost);
    if (errors.length > 1) {
        res.status(400).json(errors);
        return;
    }

    if (!pgPool) {
        // Cold start. Get Heroku Postgres creds and create pool.
        await createPgPool();
    } else {
        console.log('Using existing PostgreSQL connection pool.');
    }

    if (!esClient) {
        // Cold start. Create Elasticsearch connection.
        await createEsClient();
    } else {
        console.log('Using existing Elasticsearch connection.');
    }

    try {
        const pgClient = await pgPool.connect();
        const service = new PostService(console, pgClient, esClient);

        const id = await service.savePost(newPost);

        pgClient.release();

        res.status(201).json({
            newId: id,
        });
        return;
    } catch (e) {
        res.json({
            error: e.message,
        });
        return;
    }
});

app.get('/posts/:id', async function (req, res) {
    const postId = req.params.id;

    if (_.isNil(postId) || !_.isString(postId) || postId.length === 0) {
        res.status(400).json({
            error: 'Must specify ID which is a string of min length 1.',
        });
        return;
    }

    if (!pgPool) {
        // Cold start. Get Heroku Postgres creds and create pool.
        await createPgPool();
    } else {
        console.log('Using existing PG connection.');
    }

    try {
        const pgClient = await pgPool.connect();
        const service = new PostService(console, pgClient, null);
        pgClient.release();

        const post = await service.getPostById(postId);

        res.json(post);
        return;
    } catch (e) {
        res.json({
            error: e.message,
        });
        return;
    }
});

app.post('/onrelease', async function (req, res) {
    // Get Heroku Postgres creds and replace pool with new one.
    await createPgPool();

    // Response with 2xx response so Heroku knows webhook was successful.
    // Response body doesn't matter.
    res.status(204).send();
});

module.exports = {
    app,
    hello: serverless(app),
};
