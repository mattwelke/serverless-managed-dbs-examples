'use strict';

const _ = require('lodash');

const validate = post => {
    const errors = [];

    const requiredProps = [
        {
            name: 'title',
            type: 'string',
            minLength: 20,
        },
        {
            name: 'author',
            type: 'string',
            minLength: 10,
        },
        {
            name: 'body',
            type: 'string',
            minLength: 40,
        },
    ];

    requiredProps.forEach(prop => {
        if (_.isNil(post[prop.name])) {
            errors.push(`Property '${prop.name}' is required.`);
        } else {
            switch (prop.type) {
                case 'string':
                    if (!_.isString(post[prop.name])) {
                        errors.push(`Property '${prop.name}' must be a string.`);
                    } else {
                        if (post[prop.name].length < prop.minLength) {
                            errors.push(`Property '${prop.name}' has minimum length of ${prop.minLength}.`);
                        }
                    }
                    break;
            }
        }
    });

    return errors;
};

module.exports = validate;
