const { expect } = require('chai');

const InitMicroService = require('../support/setup/unit');
const ModelWrapper = require('../../src/ModelWrapper');

class MockModel {
    constructor(modelName, properties = {}){
        this.modelName = modelName;
        this.dataSource = {
            connector: {
                name: 'test',
                table(modelName){
                    return modelName;
                },
                schema(modelName){
                    return 'test';
                },
            },
        };
        this.definition = {
          properties: properties,
        };
    }
}

describe('The ModelWrapper class', function(){

    InitMicroService();

    describe('ModelWrapper.constructor(model, alias)', function(){
        it('can be instantiated by passing a model and an optional alias', function(){
            const model = new MockModel();
            const wrapper = new ModelWrapper(model, 'test');
            expect(wrapper).to.be.instanceOf(ModelWrapper);
        });
    });

    describe('ModelWrapper.getColumnName(key, options = {})', function(){

        it('resolves the fully qualified column name (if no alias is given)', function() {
            const model = new MockModel('TestModel', { date: {} });
            const wrapper = new ModelWrapper(model);

            expect(wrapper.getColumnName('date')).to.be.equal('test.TestModel.date');
        });

        it('overrides the table name given by the connector by the alias passed in the constructor', function() {
            const model = new MockModel(undefined, { date: {} });
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('date')).to.be.equal('test.date');
        });

        it('allows overriding the alias by passing it via options', function() {
            const model = new MockModel(undefined, { date: {} });
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('date', {alias: 'aliased'})).to.be.equal('aliased.date');
        });

        it('preserves the case of the colum name by default', function(){
            const model = new MockModel('TestModel', { startDate: {} });
            const wrapper = new ModelWrapper(model, 'test');
            expect(wrapper.getColumnName('startDate')).to.be.equal('test.startDate');
        });

        it('converts the column name to lower case if the "preserveCase" option is set to false', function(){
            const model = new MockModel('TestModel', { startDate: {} });
            const preserveCase = false;
            const wrapper = new ModelWrapper(model, 'test');

            expect(wrapper.getColumnName('startDate', {preserveCase})).to.be.equal('test.startdate');
        });

        it('use custom column name if configured for the model connector', function(){
          const model = new MockModel('TestModel', { startDate: { test: {columnName: 'start_date'}} });
          const wrapper = new ModelWrapper(model, 'test');

          expect(wrapper.getColumnName('startDate')).to.be.equal('test.start_date');
        });

    });
});
