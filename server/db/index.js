// Database abstraction layer
// Uses PostgreSQL if DB_HOST is set, otherwise falls back to SQLite

const usePostgres = !!process.env.DB_HOST;

let dbModule;
if (usePostgres) {
    console.log('Using PostgreSQL database');
    dbModule = require('./postgres');
} else {
    console.log('Using SQLite database');
    dbModule = require('./sqlite');
}

// Initialize database on first import
let dbInitialized = false;
const initPromise = dbModule.initDb().then(() => {
    dbInitialized = true;
    console.log('Database initialized');
}).catch(err => {
    console.error('Database initialization failed:', err);
});

module.exports = {
    query: async (...args) => {
        if (!dbInitialized) await initPromise;
        return dbModule.query(...args);
    },
    initDb: dbModule.initDb,
    saveDb: dbModule.saveDb || (() => {}),
    getDb: dbModule.getDb || (() => null)
};
