const { expect } = require('chai');

const SetupIntegration = require('../support/setup/integration');
const createAndLinkBookData = require('../support/fixtures/createAndLinkBookData');

describe('The loopback-search-component', () => {

    SetupIntegration();

    before(function() {
        this.Book = this.models.Book;
        this.Publisher = this.models.Publisher;
        this.Page = this.models.Page;
        this.Author = this.models.Author;
    });

    before('create and link book data', async function() {
        return createAndLinkBookData(this.models);
    });

    it('the component allows filtering over related models', async function() {

        const query = {
            where: {
                authors: {
                    firstName: 'George',
                    lastName: {
                        ilike: 'orwe%',
                    },
                },
            },
            include: ['authors'],
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(2);

        const book1 = books.find(book => book.title === 'Animal Farm');
        const book2 = books.find(book => book.title === '1984');

        expect(book1).to.be.ok;
        expect(book2).to.be.ok;
    });

    it('the component respects original id restrictions', async function() {

        const title = 'Animal Farm';
        // we need to query the expected book first to get the correct id
        const animalFarm = await this.models.Book.findOne({where: {title}});
        const query = {
            where: {
                id: animalFarm.id,
                authors: {
                    firstName: 'George',
                    lastName: {
                        ilike: 'orwe%',
                    },
                },
            },
            include: ['authors'],
        };

        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);


        expect(books).to.have.length(1);

        const book1 = books.find(book => book.title === title);

        expect(book1).to.be.ok;
    });

    it('the component respects original id restrictions in or queries', async function() {

        const title = 'Animal Farm';
        // we need to query the expected book first to get the correct id
        const animalFarm = await this.models.Book.findOne({where: {title}});
        const query = {
            where: {
                or: [
                    {
                        id: animalFarm.id,
                    },
                    {
                       title: 'The great gatsby',
                    },
                ],
            },
            include: ['authors'],
        };

        const books = await this.apiClient.get('/books')
            .query({filter: JSON.stringify(query)})
            .then(result => result.body);

        expect(books).to.have.length(2);

        const book1 = books.find(book => book.title === title);

        expect(book1).to.be.ok;
    });

    it('the component respects original id restrictions with nested or queries', async function() {

        const title = 'Animal Farm';
        // we need to query the expected book first to get the correct id
        const animalFarm = await this.models.Book.findOne({where: {title}});
        const query = {
            where: {
                or: [
                    {
                        id: animalFarm.id,
                    },
                    {
                        authors: {
                            firstName: 'Scott',
                        },
                    },
                ],
            },
            include: ['authors'],
        };

        const books = await this.apiClient.get('/books')
            .query({filter: JSON.stringify(query)})
            .then(result => result.body);

        expect(books).to.have.length(2);

        const book1 = books.find(book => book.title === title);

        expect(book1).to.be.ok;
    });

    it('the component should not fail if no models match the query', async function() {

        const query = {
            where: {
                authors: {
                    firstName: 'Hans',
                },
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);
    });

    it('the component properly transforms between operators in or queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                or: [
                    {
                        id: { between: [book1.id, book2.id]},
                    },
                    {
                        id: { between: [book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(4);

        const excluded = books.find(book => book.id === book3.id);
        expect(excluded).to.be.undefined;
    });

    it('the component properly transforms between operators in and queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                and: [
                    {
                        id: { between: [book2.id, book3.id]},
                    },
                    {
                        id: { between: [book3.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(1);

        const excluded = books.find(book => book.id === book3.id);
        expect(excluded).to.not.be.undefined;
    });

    it('the component properly transforms in operators in and queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                and: [
                    {
                        id: { inq: [book1.id, book2.id, book3.id]},
                    },
                    {
                        id: { inq: [book3.id, book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(1);

        expect(books[0]).to.have.property('id', book3.id);
    });

    it('the component properly transforms in operators in or queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                or: [
                    {
                        id: { inq: [book1.id, book2.id, book3.id]},
                    },
                    {
                        id: { inq: [book3.id, book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(5);
    });

    it('the component properly transforms in operators in mixed or queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                id: { inq: [book1.id, book2.id, book3.id]},
                or: [
                    {
                        id: { inq: [book3.id, book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(5);
    });

    it('the component properly transforms not in operators in and queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                and: [
                    {
                        id: { nin: [book1.id, book2.id]},
                    },
                    {
                        id: { nin: [book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(1);
        expect(books[0]).to.have.property('id', book3.id);
    });

    it('the component properly transforms not in operators in or queries', async function() {

        const allBooks = await this.models.Book.find();
        const [book1, book2, book3, book4, book5] = allBooks;

        const query = {
            where: {
                or: [
                    {
                        id: { nin: [book1.id, book2.id, book3.id]},
                    },
                    {
                        id: { nin: [book3.id, book4.id, book5.id]},
                    },
                ]
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(4);

        const excludedBook = books.find(book => book.id === book3.id);

        expect(excludedBook).to.be.undefined;
    });

    it('the component allows querying over multiple entities 1', async function() {

        const query = {
            where: {
                author: {
                    lasName: {
                        like: 'Orw%',
                    },
                },
                publisher: {
                    name: 'NAL',
                },
            },
            include: ['authors'],
        };
        // test to fix a bug if no data was found
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(1);
        expect(books.find(({title}) => title === 'Animal Farm')).to.be.ok;
    });

    it('the component allows querying over multiple entities 2', async function() {

        const query = {
            where: {
                books: {
                    publisher: {
                        name: {
                            ilike: 'nal',
                        },
                    }
                },
            },
        };
        // test to fix a bug if no data was found
        const authors = await this.apiClient.get('/authors')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(authors).to.have.length(1);
        expect(authors[0]).to.have.property('lastName', 'Orwell');
    });

    it('the component should prevent the invocation of the default remote method (find) from finding ' +
        'data (otherwise loopback would return the default result)',
        async function() {

            const query = {
                where: {
                    authors: {
                        firstName: 'Hans',
                    },
                },
                include: ['authors'],
            };
            // test to fix a bug if no data was found
            const books = await this.apiClient.get('/books')
                .query({ filter: JSON.stringify(query) })
                .then(result => result.body);

            expect(books).to.have.length(0);
    });

    it('the component creates a corresponding error for unknown properties ' +
        '(if configured accordingly, as in our component-config)', async function() {

        const query = {
            where: {
                test: 'unknown',
            },
        };

        try {
            const response = await (this.apiClient.get('/authors')
                .set('accept', 'application/json')
                .query({ filter: JSON.stringify(query) })
                .then(result => result.body));
        } catch (err) {
            expect(err).to.have.property('status', 400);
            return;
        }
        throw new Error('Querying property "test" on "/authors" did not fail as expected.');
    });

    it('the error behavior for unknown properties can be configured on a per model base ' +
        '(as in our book.json where we override rejectUnknownProperties)', async function() {

        const query = {
            where: {
                unknown: 'test',
            },
        };
        // otherwise this test would fail
        await (this.apiClient.get('/books')
            .set('accept', 'application/json')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body));
    });

    it('allows querying over multiple relations 1', async function() {

        const query = {
            where: {
                lastName: {
                    like: 'Orw%',
                },
                books: {
                    publisher: {
                        name: 'NAL',
                    },
                },
            },
        };
        // test to fix a bug if no data was found
        const authors = await this.apiClient.get('/authors')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(authors).to.have.length(1);
    });

    describe('the component allows ordering', function(){

      it('the component allows ordering over main model', async function() {

        const query = {
            include: ['publisher'],
            order: 'title DESC'
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(5);

        expect(books[0]).to.have.property('title', 'The hunger games');
        expect(books[1]).to.have.property('title', 'The great gatsby');
        expect(books[2]).to.have.property('title', 'Harry Potter');
        expect(books[3]).to.have.property('title', 'Animal Farm');
        expect(books[4]).to.have.property('title', '1984');

      });

      it('the component allows ordering over belongsTo related model property', async function() {

        const query = {
            include: ['publisher'],
            order: 'publisher.name ASC'
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
            .query({ filter: JSON.stringify(query) })
            .then(result => result.body);

        expect(books).to.have.length(3);

        expect(books[0]).to.have.property('title', 'Animal Farm');
        expect(books[1]).to.have.property('title', 'The great gatsby');
        expect(books[2]).to.have.property('title', '1984');

      });

      it('the component allows ordering over hasAndBelongsToMany related model property', async function() {

        const query = {
          include: ['publisher'],
          order: 'authors.lastName ASC'
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
        .query({ filter: JSON.stringify(query) })
        .then(result => result.body);

        expect(books).to.have.length(3);

        expect(books[0]).to.have.property('title', 'The great gatsby');
        expect(books[1]).to.have.property('title', '1984');
        expect(books[2]).to.have.property('title', 'Animal Farm');

      });

      it('the component allows multiple ordering clauses', async function() {

        const query = {
          include: ['publisher'],
          order: ['authors.lastName ASC', 'title DESC']
        };
        // this will usually return 5 books
        const books = await this.apiClient.get('/books')
        .query({ filter: JSON.stringify(query) })
        .then(result => result.body);

        expect(books).to.have.length(3);

        expect(books[0]).to.have.property('title', 'The great gatsby');
        expect(books[1]).to.have.property('title', 'Animal Farm');
        expect(books[2]).to.have.property('title', '1984');

      });

    });

    describe('loopback-search-component configuration', function(){
        // this test is for documentation
        it('preserveColumnCase: Can be set in the component configuration. Most tests in this suite' +
            'only work because it is set to false (defaults to true) since Loopback`s automigrate' +
            'converts all column names to lowercase', function(){});

        it('preserveColumnCase: Can be set in the "searchConfig" section of a model config to override' +
            'the global setting.', async function(){
            const query = {
                where: {
                    bookId: 1,
                },
            };
            try {
                await this.apiClient.get('/pages')
                    .set('accept', 'application/json')
                    .query({ filter: JSON.stringify(query) })
                    .then(result => result.body);
            } catch(error) {
                return;
            }
            throw new Error('Querying a camel cased property on an autogenerated model without setting' +
                'the preserveColumnCase option to false should fail');
        });

        it('preserveColumnCase: Can be set in the "searchConfig" section of a model config to override' +
            'the global setting (check the error by invoking the internal method).', async function(){
            const query = {
                where: {
                    bookId: 1,
                },
            };

            try {
                await this.Page.find(query);
            } catch(err){
                expect(err.message).to.contain('page.bookId');
                return;
            }
            throw new Error('Querying a camel cased property on an autogenerated model without setting' +
                'the preserveColumnCase option to false should fail');
        });
    });
});
