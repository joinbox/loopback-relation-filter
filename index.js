const error = require('./src/error');

const SearchQueryBuilder = require('./src/SearchQueryBuilder');
const { UnknownPropertyError, UnsupportedDatasourceError } = require('./src/error');

/**
 * Loopback component that allows filtering over related models using the where filter.
 */
module.exports = function(loopbackApp, settings) {

    Object
        .values(loopbackApp.models)
        .forEach((model) => {

            const searchConfig = getSearchSettings(model, settings);

            if (searchConfig.enabled === true) {
                model.observe('access', extendedFindQuery(model, loopbackApp.models, searchConfig));
            }

        });
};

// Export the component specific error classes.
module.exports.error = error;

/**
 * Creates the function which is invoked for the 'find' and 'findOne' remote hook of loopback.
 *
 * For more information on remote hooks see https://loopback.io/doc/en/lb3/Remote-hooks.html
 *
 * @param model a loopback model
 * @param models the loopback models object
 * @returns {Function}
 */
function extendedFindQuery(model, models, { rejectUnknownProperties = false, preserveColumnCase = true } = {}) {
    return function(ctx, next) {
        const originalWhere = getWhereFilter(ctx);
        /**
         * @todo: check if the connector supports/requires filtering
         * @todo: check if the query accesses relations
         */
        if (!originalWhere) {
            next();
        } else {
            const options = { rejectUnknownProperties, preserveColumnCase };
            const builder = new SearchQueryBuilder(models, options);
            const query = Object.assign({}, originalWhere);

            try {
                const idName = model.getIdName();
                const databaseQuery = builder.buildQuery(model.modelName, { where: query });
                const sqlString = databaseQuery.toString();

                model.dataSource.connector.execute(sqlString, (err, result) => {
                    if (err) {
                        next(err);
                    } else if (!result || result.length === 0) {
                        // no results match our query, prevent loopback from returning a result
                        // setting it to false would cause loopback to throw an error because
                        // it is no integer
                        ctx.query.where = {[idName]: -1};
                        next();
                    } else {
                        const resultIds = result.map(entry => entry[idName]);
                        // Removed the check for an existing id query, since the result of the
                        // database query should include the corresponding id already!
                        // Therefore we remove all the other constrains since they could lead to
                        // contradicting statements!
                        ctx.query.where = {[idName]: { inq: resultIds }};
                        next();
                    }
                });
            } catch (err) {
                if (err instanceof UnknownPropertyError) {
                    err.status = 400;
                } else if (err instanceof UnsupportedDatasourceError){
                    err.status = 400;
                }
                next(err);
            }
        }
    };
}

/**
 * Returns the filter query (either sent via API or remote method invocation).
 *
 * @param context the loopback request context
 * @returns {null}
 */
function getWhereFilter(context = {}) {
    const query = context.query || {};
    return query.where;
}

/**
 * Gets the relationFilter settings from the models configuration (setting) and merges
 * them with the basic component settings.
 *
 * @param model a loopback model
 * @param componentSettings general settings of the component
 * @returns {*}
 */
function getSearchSettings(model, componentSettings = {}) {
    const modelSettings = model.definition.settings.relationFilter || {};
    return Object.assign({}, componentSettings, modelSettings);
}
