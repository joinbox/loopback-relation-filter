# loopback-relation-filter
Enables where query filters on related loopback models.

## Features

* Full support of postgresql connector
* The queries are build internally with Knex.js
* Beta support of mysql connector

## Configuration

Enable/disable extended searching for all models in your `component-config`:

```Json
{
    "loopback-component-relation-filter": {
        "enabled": true,
        "rejectUnknownProperties": true,
        "preserveColumnCase": true
    }
}

```

Enable/disable searching in a specific model config:

```Json
{
    "relationFilter": {
        "enabled": true,
        "rejectUnknownProperties": true,
        "preserveColumnCase": false
    }
}
```

### RejectUnknownProperties

If `rejectUnknownProperties` (default is `true`) is set to `false` the component will not throw an error during the 
normalization if the queried property/relation does not exist on the queried model. 
One can use this configuration value to ensure that legacy queries still work properly and do not 
fail.

### PreserveColumnCase

If `preserveColumnCase` is set to false, column names are converted to lowercase when building the 
query. This option allows the user to make the filtering work with older, auto generated models 
(i.e. using `automigrate/-update`) where the column names were lowercased (e.g. property `startDate` 
will be converted to a column `startdate`). 


## Testing

Check the `package.json` to see how to execute tests:

  - **all:** `npm test`
  - **unit:** `npm run test:unit`
  - **integration:** `npm run test:integration`
  - **watch tests during development:** `npm run test:watch` (uses mocha's `--watch` option)
  - **linting:** `npm run lint`

To launch test for mysql connector use `NODE_ENV=mysql_test` 
