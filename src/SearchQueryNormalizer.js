
const ModelWrapper = require('./ModelWrapper');
const error = require('./error');
const LoopbackDaoUtils = require('loopback-datasource-juggler/lib/utils');
const _ = require('lodash');

const defaultSupportedOpperators = [
    '=',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'like',
    'nlike',
    'ilike',
    'nilike',
    'inq',
    'nin',
    'between',
    'regexp',
];

/**
 * @todo: add a custom error type for easier handling
 * @todo: add a possibility to detect invalid operators
 */

module.exports = class SearchQueryNormalizer {

    constructor(models, {
        supportedOperators = defaultSupportedOpperators,
        rejectUnknownProperties = false,
    } = {}) {
        this.models = models;
        this.wrappedModels = {};
        this.supportedOperators = supportedOperators;
        this.rejectUnknownProperties = rejectUnknownProperties;
    }

    normalizeQuery(rootModelName, where) {
        return this.normalizeWhereQuery(rootModelName, where);
    }

    setUnknownPropertyRejection(rejectUnknown) {
        this.rejectUnknownProperties = rejectUnknown === true;
    }

    normalizeWhereQuery(rootModelName, where) {
        const rootModel = this.getWrappedModel(rootModelName);
        const normalizedAnd = [];
        const normalizedOr = [];
        Object
            .keys(where)
            .forEach((property) => {
                const query = where[property];

                if (property === 'and') {
                    normalizedAnd.push(...query);
                } else if (property === 'or' && normalizedAnd.length === 0) {
                    normalizedOr.push(...query);
                } else if (this.isValidProperty(rootModel, property)) {
                    // this also includes or queries
                    normalizedAnd.push({ [property]: query });
                } else {
                    this.handleInvalidProperty(rootModel, property, where);
                }
            });

        const result = {};
        if (normalizedAnd.length) {
            result.and = this.normalizeQueryCollection(rootModel, normalizedAnd);
        }
        if (normalizedOr.length) {
            result.or = this.normalizeQueryCollection(rootModel, normalizedOr);
        }

        return result;
    }

    normalizeOrder(rootModelName, order) {
        const rootModel = this.getWrappedModel(rootModelName);
        const normalizedOrder = [];

        if(!order){
          return normalizedOrder;
        }

        if(!Array.isArray(order)){
          order = [order];
        }

        order.forEach( orderClause => {
          const [propertyPath, direction] = orderClause.split(' ');

          normalizedOrder.push(_.set({}, propertyPath, direction.toLowerCase()));
        });

        return normalizedOrder;
    }

    /**
     * @todo: add logging?
     *
     * @param model
     * @param property
     * @param query
     */
    handleInvalidProperty(model, property, query) {
        if (this.rejectUnknownProperties) {
            const queried = JSON.stringify(query);
            const message = `Unknown property "${model.getName()}.${property}" queried in (${queried}).`;
            throw new error.UnknownPropertyError(message);
        }
    }

    normalizeQueryCollection(model, queryCollection) {
        return queryCollection.reduce((queries, query) => {
            Object
                .keys(query)
                .forEach((property) => {
                    if (model.isProperty(property)) {
                        queries.push(this.normalizeProperty(model, property, query[property]));
                    }
                    if (model.isRelation(property)) {
                        const targetModel = model.getRelation(property).modelTo;
                        queries.push({
                            [property]: this.normalizeQuery(targetModel.modelName, query[property]),
                        });
                    }
                    if (property === 'and') {
                        queries.push({
                            and: this.normalizeQueryCollection(model, query.and),
                        });
                    }
                    if (property === 'or') {
                        queries.push({
                            or: this.normalizeQueryCollection(model, query.or),
                        });
                    }
                });
            return queries;
        }, []);
    }

    normalizeProperty(rootModel, property, query) {
        const comparison = this.hasSupportedOperator(query) ? query : { '=': query };
        if (comparison.regexp) {
          comparison.regexp = LoopbackDaoUtils.toRegExp(comparison.regexp);
        }
        return {
            [property]: comparison,
        };
    }

    hasSupportedOperator(value) {
        if (!value) return false;
        return this.supportedOperators
            .some(operator => Object.prototype.hasOwnProperty.call(value, operator));
    }

    isValidProperty(model, property) {
        return model.isProperty(property)
            || model.isRelation(property)
            || property === 'and'
            || property === 'or';
    }

    getWrappedModel(name) {
        if (!this.wrappedModels[name]) {
            this.wrappedModels[name] = new ModelWrapper(this.models[name]);
        }
        return this.wrappedModels[name];
    }
};
