const { expect } = require('chai');

const InitMicroService = require('../support/setup/unit');
const TableAliasProvider = require('../../src/TableAliasProvider');

describe('The TableAliasProvider Class', () => {

    InitMicroService();

    beforeEach(function(){
        this.provider = new TableAliasProvider();
    });

    it('can be instantiated empty', function(){
        expect(this.provider).to.have.property('separator', '_');
    });

    it('can be with aliases and a custom separator', () => {
        const aliases = {test: 'test:table:1'};
        const separator = ':';
        const provider = new TableAliasProvider(aliases, separator);

        expect(provider).to.have.property('aliases', aliases);
        expect(provider).to.have.property('separator', separator);
    });

    it('#hasAlias: checks if there is an alias', () => {
        const aliases = {test: 'test:table:1'};
        const separator = ':';
        const provider = new TableAliasProvider(aliases, separator);

        expect(provider.hasAlias('test')).to.be.true;
        expect(provider.hasAlias('dummy')).to.be.false;
    });

    it('#createAlias: creates an alias name for a model without relation or through model, ' +
        'counting invocations', function(){
        const alias = this.provider.createAlias('test');
        expect(alias).to.be.equal('test');

        const alias2 = this.provider.createAlias('test');
        expect(alias2).to.be.equal('test_1');
    });

    it('#createAlias: creates an alias name for a model relation', function(){
        const alias = this.provider.createAlias('Book', 'pages');
        expect(alias).to.be.equal('book_pages');
    });

    it('#createAlias: creates an alias name for a model relation and counts invocations', function(){
        this.provider.createAlias('Book', 'pages');
        const alias = this.provider.createAlias('Book', 'pages');
        expect(alias).to.be.equal('book_pages_1');
    });

    it('#createAlias: creates an alias name for a model relation and respects a through model', function(){
        const alias = this.provider.createAlias('Book', 'authors', { through: 'main_authors'});
        expect(alias).to.be.equal('book_main_authors_authors');
    });

    it('#createAlias: creates an alias name for a model relation and respects a through model ' +
        'and counts invocations', function(){
        this.provider.createAlias('Book', 'authors', { through: 'main_authors'});
        const alias = this.provider.createAlias('Book', 'authors', { through: 'main_authors'});
        expect(alias).to.be.equal('book_main_authors_authors_1');
    });

});
