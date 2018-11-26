const knex = require('knex');
const _ = require('lodash');

const ModelWrapper = require('./ModelWrapper');
const TableAliasProvider = require('./TableAliasProvider');
const SearchQueryNormalizer = require('./SearchQueryNormalizer');

const { UnknownOperatorError }= require('./error');

/**
 * @todo: remove the state by instantiating a new table alias provider
 * @todo: remove all methods that should not belong to the interface (i.e. only preserve buildQuery or build)
 *
 * @type {module.SearchQueryBuilder}
 */

module.exports = class SearchQueryBuilder {

    constructor(models, { rejectUnknownProperties = false, preserveColumnCase = true } = {}) {
        this.models = models;
        this.preserveColumnCase = preserveColumnCase;
        this._supportedClients = {
            postgresql: 'pg',
            mysql: 'mysql'
        };
        this.supportedOperators = [
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
        ];
        const options = {
            supportedOperators: this.supportedOperators,
            rejectUnknownProperties,
        };
        this.normalizer = new SearchQueryNormalizer(models, options);
    }

    getQueryBuilder(wrappedModel) {
        const client = this.getClientName(wrappedModel);
        return knex({ client });
    }

    getClientName(model) {
        const connectorName = model.getConnectorName();
        return this._supportedClients[connectorName];
    }

    queryRelationsAndProperties(builder, rootModel, aliasProvider, query, order) {

        const joinAliasProvider = aliasProvider.spawnProvider();
        const filterAliasProvider = aliasProvider.spawnProvider();
        // 1. iterate the query and collect all joins
        const joins = this.getAllJoins(rootModel, query, order, joinAliasProvider);
        joins.forEach(({ table, keyFrom, keyTo }) => {
            builder.join(table, { [keyFrom]: keyTo });
        });
        // 2. iterate the query and apply all filters (we need to keep track of the aliases the
        // same way we did before in the joins).
        this.applyFilters(builder, rootModel, query, filterAliasProvider);
        // 3. iterate the order clauses and apply them
        return this.applyOrder(builder, rootModel, order, filterAliasProvider);
    }

    applyFilters(builder, rootModel, { and = [], or = [] }, aliasProvider) {
        // Store the relations encountered on the current level to prevent the builder from
        // joining the same table multiple times.
        const relations = {};
        // Iterate depth-first and create all aliases!
        builder.andWhere((subBuilder) => {
            const options = { preserveCase: this.preserveColumnCase, isOr: false };
            this._handleFilters(and, subBuilder.and, rootModel, aliasProvider, relations, options);
        });

        builder.orWhere((subBuilder) => {
            const options = { preserveCase: this.preserveColumnCase, isOr: true };
            this._handleFilters(or, subBuilder.or, rootModel, aliasProvider, relations, options);
        });

        return builder;
    }

    _handleFilters(filters, builder, rootModel, aliasProvider, relations, opts) {
        this._forEachQuery(filters, (propertyName, query) => {
            // Since we proceed the filters recursively (depth-first) we need to restore the state
            // of the query builder every time we enter a new branch.
            const subQueryBuilder = opts.isOr ? builder.or : builder.and;
            if (rootModel.isRelation(propertyName)) {
                const { modelTo } = this._trackAliases(
                    rootModel,
                    propertyName,
                    aliasProvider,
                    relations,
                    opts,
                );
                this.applyFilters(subQueryBuilder, modelTo, query, aliasProvider);
            }
            if (rootModel.isProperty(propertyName)) {
                const propertyFilter = {
                    property: rootModel.getColumnName(propertyName, opts),
                    value: query,
                };
                this.applyPropertyFilter(propertyFilter, subQueryBuilder);
            }
        });
    }

    applyOrder(builder, rootModel, orderClauses, aliasProvider) {
      const relations = {};
      const options = { preserveCase: this.preserveColumnCase };
      orderClauses.forEach(order => {
        this._handleOrder(order, builder, rootModel, aliasProvider, relations, options);
      });

      return builder;
    }

    _handleOrder(order, builder, rootModel, aliasProvider, relations, options) {
        _.mapValues(order, (subOrder, propertyName) => {
            if (rootModel.isRelation(propertyName)) {
                const { modelTo } = this._trackAliases(
                    rootModel,
                    propertyName,
                    aliasProvider,
                    relations,
                    options,
                );
                this._handleOrder(subOrder, builder, modelTo, aliasProvider, relations, options);
            }
            if (rootModel.isProperty(propertyName)) {
                const propertyOrder = {
                    orderAlias: rootModel.alias + '_' + propertyName,
                    property: rootModel.getColumnName(propertyName, options),
                    direction: subOrder,
                };
                this.applyPropertyOrder(propertyOrder, builder);
            }
        });
    }

    _forEachQuery(collection, callback) {
        collection.forEach((query) => {
            Object.keys(query).forEach((propertyName) => {
                callback(propertyName, query[propertyName]);
            });
        });
    }

    _trackAliases(rootModel, relationName, aliasProvider, seenRelations, options = {}) {

        const previousResult = seenRelations[relationName];

        if (previousResult) {
            return previousResult;
        }

        const relation = rootModel.getRelation(relationName);
        const throughModel = relation.modelThrough;

        const modelToAlias = this.createAlias(aliasProvider, rootModel.getName(), relation);
        const modelTo = ModelWrapper.fromModel(relation.modelTo, modelToAlias);
        const table = modelTo.getAliasedTable();
        const keyFrom = rootModel.getColumnName(relation.keyFrom, options);

        const aliases = {
            keyFrom,
            modelTo,
            relation,
            table,
        };

        if (throughModel) {
            const throughAlias = this.createAlias(
                aliasProvider,
                rootModel.getName(),
                relation,
                true,
            );
            aliases.modelThrough = ModelWrapper.fromModel(throughModel, throughAlias);
        }

        seenRelations[relationName] = aliases;

        return aliases;
    }

    /**
     * Iterates over the normalized query and collects all necessary joins by creating according
     * aliases.
     *
     * @param rootModel
     * @param and
     * @param or
     * @param aliasProvider
     * @return {*}
     */
    getAllJoins(rootModel, { and = [], or = [] }, order, aliasProvider) {
        const filters = and.concat(or).concat(order);
        const children = [];
        const relations = {};
        const joins = [];
        const opts = { preserveCase: this.preserveColumnCase };

        this._forEachQuery(filters, (propertyName, query) => {
            // The result found for the join (gathered by _trackAliases) is stored on the
            // relations object.
            if (rootModel.isRelation(propertyName) && !relations[propertyName]) {
                // alias the model we are going to join
                const aliases  = this._trackAliases(
                    rootModel,
                    propertyName,
                    aliasProvider,
                    relations,
                    opts,
                );
                // store the children of the current level for breadth-first traversal
                children.push({ model: aliases.modelTo, query });
                // its kind of a reference (not a mapping)
                if (!aliases.modelThrough) {
                    joins.push(this._joinReference(aliases, opts));
                } else {
                    joins.push(...this._joinMapping(aliases, opts));
                }
            }
        });
        // append all joins of the lower levels
        return children.reduce((allJoins, { model, query }) => {
            let childOrder = [];
            if(!query.and && !query.or){
              childOrder = [query];
            }
            const lowerJoins = this.getAllJoins(model, query, childOrder, aliasProvider);
            allJoins.push(...lowerJoins);
            return allJoins;
        }, joins.slice(0));
    }

    _joinMapping({keyFrom, modelTo, modelThrough, relation, table}, opts){
        // get the id of the target model
        const [targetModelId] = modelTo.getIdProperties({
            ignoreAlias: true,
            preserveCase: this.preserveColumnCase,
        });
        // do a reverse lookup of the current relation and try to find out the
        // referenced property of the target model
        const relationTargetProperty = modelTo.getPropertyQueriedThrough(relation);
        // first join is for the mapping table, the second one joins the target
        // model's table
        const targetKey = relationTargetProperty || targetModelId;
        return [
            {
                table: modelThrough.getAliasedTable(),
                keyFrom,
                keyTo: modelThrough.getColumnName(relation.keyTo, opts),
            },
            {
                table,
                keyFrom: modelThrough.getColumnName(relation.keyThrough, opts),
                keyTo: modelTo.getColumnName(targetKey, opts),
            },
        ];
    }

    _joinReference({keyFrom, modelTo, relation, table}, opts){
        const keyTo = modelTo.getColumnName(relation.keyTo, opts);
        return {
            table,
            keyFrom,
            keyTo,
        };
    }

    /**
     * Appends a where filter to the query passed by builder.
     *
     * @param   {property, value} Whereas property is the fully resolved name of the property
     *          and value the value to compare. The value should be an object of the form
     *          {operator: comparedValue}. The method will map operator to a valid postgres
     *          comparison operator and create a where statement of the form
     *          `property operator comparedValue`
     * @param {KnexQueryBuilder} the knex query builder
     *
     * @return {KnexQueryBuilder} the knex query builder
     */
    applyPropertyFilter({ property, value }, builder) {

        if (!value) return;
        const operatorMap = {
            neq: '!=',
            gt: '>',
            lt: '<',
            gte: '>=',
            lte: '<=',
            like: 'like',
            ilike: 'ilike',
            nlike: 'not like',
            nilike: 'not ilike',

        };
        const operator = this.supportedOperators.find(op => {
            return Object.prototype.hasOwnProperty.call(value, op);
        });
        // The default case should never be used due to the normalization.
        if (operator) {
            const content = value[operator];
            switch (operator) {
            case '=':
                return builder.where(property, content);
            case 'neq':
            case 'gt':
            case 'lt':
            case 'gte':
            case 'lte':
            case 'like':
            case 'ilike':
            case 'nlike':
            case 'nilike': {
                const mappedOperator = operatorMap[operator];
                return builder.where(property, mappedOperator, content);
            }
            case 'between':
                return builder.whereBetween(property, content);
            case 'inq':
                return builder.whereIn(property, content);
            case 'nin':
                return builder.whereNotIn(property, content);
            default:
                const valueString = JSON.stringify(value);
                const msg = `Unknown operator encountered when comparing ${property} to ${valueString}`;
                throw new UnknownOperatorError(msg);
            }
        }
        return builder;
    }

    /**
     * Appends a order clause to the query passed by builder.
     *
     * @param   {orderAlias, property, direction} Whereas orderAlias is the given unique alias for this order clause
     *          property is the fully resolved name of the property
     *          and direction should be asc or desc
     * @param {KnexQueryBuilder} the knex query builder
     *
     * @return {KnexQueryBuilder} the knex query builder
     */
    applyPropertyOrder({ orderAlias, property, direction }, builder) {
      if(direction === 'asc'){
        builder.min({ [orderAlias]: property });
      } else {
        builder.max({ [orderAlias]: property });
      }

      return builder.orderBy(orderAlias, direction);
    }

    /**
     * Creates the root select statement, normalizes the where query using the given normalizer
     * and recursively invokes the query building.
     *
     * @param {KnexQueryBuilder} the knex builder instance
     * @param {ModelWrapper} the wrapped model to start from
     * @param {TableAliasProvider} the provider keeping track of the encountered tables
     * @param {Object} the filter object from the request
     *
     * @return {*}
     */
    createRootQuery(builder, rootModel, aliasProvider, filter = {}) {

        const [id] = rootModel.getIdProperties({ preserveCase: this.preserveColumnCase });
        const tableName = rootModel.getAliasedTable();

        const basicSelect = builder(tableName).select(id).groupBy(id);

        const where = this.normalizer.normalizeQuery(rootModel.getName(), filter.where || {});
        const order = this.normalizer.normalizeOrder(rootModel.getName(), filter.order);
        const selectWithFilterApplied = this.queryRelationsAndProperties(basicSelect, rootModel, aliasProvider, where, order);
        if(filter.limit){
          selectWithFilterApplied.limit(filter.limit);
        }
        if(filter.skip){
          selectWithFilterApplied.offset(filter.skip);
        }
        return selectWithFilterApplied;
    }

    /**
     * Returns an appropriate alias for a model or a relation of a model.
     *
     * @param {TableAliasProvider} an alias provider instance
     * @param {String} the name of the model
     * @param {RelationDefinition} the loopback relation definition
     * @param {forThrough} if the alias for the through model of the relation is needed
     *
     * @return {String} the aliased name of the model or the model's relation
     */
    createAlias(aliasProvider, model, relation = null, forThrough = false) {
        const relationName = relation ? relation.name : null;
        let through;

        if (forThrough && relation) {
            const modelThrough = relation.modelThrough || {};
            through = modelThrough.modelName;
        }

        return aliasProvider.createAlias(model, relationName, { through });
    }

    /**
     * Creates a knex query for the given model, transforming the loopback filter into a
     * database specific format.
     *
     * @param modelName
     * @param filter
     * @return {*}
     */
    buildQuery(modelName, filter) {
        const aliasProvider = new TableAliasProvider();
        const rootModelAlias = this.createAlias(aliasProvider, modelName);
        const rootModel = ModelWrapper.fromModel(this.models[modelName], rootModelAlias);
        const builder = this.getQueryBuilder(rootModel);

        return this.createRootQuery(builder, rootModel, aliasProvider, filter);
    }
};
