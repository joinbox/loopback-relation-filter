module.exports = class ModelWrapper {

    constructor(model, alias = null) {
        this.model = model;
        this.connector = this.wrapConnector(model);
        this.alias = alias;
    }

    wrapConnector(model) {
        return model.dataSource.connector;
    }

    getTable() {
        const schema = this.getSchema();
        const table = this.getTableName();
        return (schema) ? `${schema}.${table}`: `${table}`;
    }

    getTableName() {
        return this.connector.table(this.getModelName());
    }

    getSchema() {
        return this.connector.schema(this.getModelName());
    }

    getFullyQualifiedTable() {
        return this.getTable();
    }

    getAliasedTable() {
        const alias = this.alias ? ` as ${this.alias}` : '';
        return `${this.getFullyQualifiedTable()}${alias}`;
    }

    getColumnName(key, { alias = this.alias, preserveCase = true } = {}) {
        const tableName = alias || this.getTable();
        const columnName = preserveCase ? key : key.toLowerCase();
        return `${tableName}.${columnName}`;
    }

    getModelName() {
        return this.model.modelName;
    }

    getConnectorName() {
        return this.connector.name;
    }

    getModelProperties() {
        return this.model.definition.properties;
    }

    getModelRelations() {
        return this.model.relations || {};
    }

    getRelation(name) {
        return this.getModelRelations()[name];
    }

    /**
     * Returns the property of the wrapped model that is referenced by the passed relation.
     *
     * Example: Book has an m:n relation to Authors stored in book_authors {bookId, authorId}. The
     * foreign key authorId references the field id of the authors table. To get the name of the
     * referenced field (id in this case) we need to lookup the definition of the Author model and
     * get the corresponding key.
     *
     * @note: we return null in case we don't find anything so the invoking component (i.e. the
     * QueryBuilder will be able to make its own assumtions on whitch property to query (e.g. take
     * the id of the target model)
     *
     * @param relation the loopback relation definition
     * @returns {(string|null)}
     */
    getPropertyQueriedThrough(relation) {
        // ensure that the relation is a mapping that references the wrapped model
        if (!!relation.modelThrough ||
            !!relation.modelTo ||
            relation.modelTo.modelName !== this.model.modelName) {
            return null;
        } else {
            const reverseRelation = Object
                .values(this.getModelRelations())
                .find((rel) => {
                    // check if it is the same through model and if it references the correct entity
                    return rel.modelThrough.modelName === relation.modelThrough.modelName
                        && rel.modelTo.modelName === relation.modelFrom.modelName;
                });
            // if there is no reverse relation, the relation to this model is unidirectional
            // and we are not able to determine the referenced field
            if (reverseRelation) {
                return reverseRelation.keyFrom;
            } else {
                return null;
            }
        }
    }

    getQueriedRelations(where = {}) {
        return Object
            .values(this.getModelRelations())
            .reduce((queriedRelations, relation) => {
                if (where[relation.name]) {
                    queriedRelations.push(relation);
                }
                return queriedRelations;
            }, []);
    }

    getIdProperties(options = {}) {
        // return the ids as an array for backwards compatibility in case of compound ids
        // (which - in general - is not supported by Loopback)
        const idName = this.model.getIdName();
        const ids = [idName];
        if (options.ignoreAlias === true) {
            return ids;
        }
        return ids.map(id => this.getColumnName(id, options));
    }

    isProperty(propertyName) {
        return Object.prototype.hasOwnProperty.call(this.getModelProperties(), propertyName);
    }

    isRelation(propertyName) {
        return Object.prototype.hasOwnProperty.call(this.getModelRelations(), propertyName);
    }

    getQueriedProperties(query = {}, options={}) {
        return Object
            .keys(query)
            .filter(propertyName => this.isProperty(propertyName))
            .map(propertyName => ({
                key: this.getColumnName(propertyName, options),
                value: query[propertyName],
            }));
    }

    getName() {
        return this.model.modelName;
    }

    as(alias) {
        return new ModelWrapper(this.model, alias);
    }

    static fromModel(model, alias = null) {
        return new ModelWrapper(model, alias);
    }
};
