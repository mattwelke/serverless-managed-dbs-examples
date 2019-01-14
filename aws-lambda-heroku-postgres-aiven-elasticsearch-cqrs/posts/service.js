'use strict';

class PostService {
    constructor(logger, pgClient, esClient) {
        this.log = logger;
        this.pgClient = pgClient;
        this.esClient = esClient;
    }

    /**
     * Saves the post in PostgreSQL and indexes it in Elasticsearch. Returns
     * the post's new ID in PostgreSQL.
     * @param {*} post The post to save.
     */
    async savePost(post) {
        const query = 'INSERT INTO posts(title, author, body) VALUES($1, $2, $3) RETURNING id;';
        const values = [post.title, post.author, post.body];

        const pgResult = await this.pgClient.query(query, values);

        const newId = pgResult.rows[0]['id'];

        // Confirmed saved in source of truth database. Index into
        // Elasticsearch too.
        const esResult = await this.esClient.create({
            index: 'posts',
            type: '_doc',
            id: newId,
            body: post,
        });

        return newId;
    }

    async getPostById(id) {
        const query = 'SELECT id, title, author, body FROM posts WHERE id = $1;';
        const values = [id];

        const result = await this.pgClient.query(query, values);

        return result.rows[0];
    }
}

module.exports = PostService;
