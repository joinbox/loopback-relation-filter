const bookData = require('./bookData');
const publisherData = require('./publisherData');
const authorData = require('./authorData');

class BookDataCreator {

    constructor(models){
        this.Book = models.Book;
        this.Publisher = models.Publisher;
        this.Page = models.Page;
        this.Author = models.Author;
    }

    async createAndLinkBookData(){
        const books = await this.createBooks(bookData());
        const authors = await this.createAuthors(authorData());
        const publishers = await this.createPublishers(publisherData());

        return this.linkData({books, authors, publishers});
    }

    async createBooks(data){
        return this.createModels(this.Book, data);
    }

    async createAuthors(data){
        return this.createModels(this.Author, data);
    }

    async createPublishers(data){
        return this.createModels(this.Publisher, data);
    }

    async createModels(model, data){
        return Promise.all(data.map((entry) => {
            return model.create(entry);
        }));
    }

    async linkData({books, authors, publishers}){
        const authorMap = this.mapEntities(authors, 'lastName');
        const publisherMap = this.mapEntities(publishers, 'name');
        const bookMap = this.mapEntities(books, 'title');

        return Promise.all([
            this._linkAuthorData(bookMap, authorMap),
            this._linkPublisherData(bookMap, publisherMap),
        ]);
    }

    async _linkAuthorData(bookMap, authorMap){
        const orwell = authorMap['Orwell'];

        orwell.books.add(bookMap['1984']);
        orwell.books.add(bookMap['Animal Farm']);

        const fitzgerald = authorMap.Fitzgerald;
        fitzgerald.books.add(bookMap['The great gatsby']);

        const collins = authorMap.Collins;
        const rowling = authorMap.Rowling;
        collins.books.add(bookMap['Harry Potter']);
        rowling.books.add(bookMap['Harry Potter']);

        return Promise.all([
            orwell.save(),
            fitzgerald.save(),
            collins.save(),
            rowling.save(),
        ]);
    }

    async _linkPublisherData(bookMap, publisherMap){
        const orwell1984 = bookMap['1984'];
        const animalFarm = bookMap['Animal Farm'];

        const theGreatGatsby = bookMap['The great gatsby'];

        orwell1984.publisher(publisherMap['Secker and Warburg']);
        animalFarm.publisher(publisherMap['NAL']);

        theGreatGatsby.publisher(publisherMap['Scribner']);

        return Promise.all([
            orwell1984.save(),
            animalFarm.save(),
            theGreatGatsby.save(),
        ]);
    }

    mapEntities(entities, property){
        return entities.reduce((map, entity) => {
            map[entity[property]] = entity;
            return map;
        }, {});
    }
}

module.exports = function(models){
    const creator = new BookDataCreator(models);
    return creator.createAndLinkBookData();
}
