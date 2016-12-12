module.exports = {
    development: {
        dbconfig: {
            dbportol: 'mongodb://',
            dbhost: 'localhost',
            dbport: ':27017',
            dbname: '/spider'
        }
    },
    production: {
        dbconfig: {
            dbportol: 'mongodb://',
            dbhost: '127.0.0.1',
            dbport: '27017',
            dbname: '/spider'
        }
    }
};