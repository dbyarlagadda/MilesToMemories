// Use SQLite database with sql.js
const { initDb, query, saveDb, getDb } = require('./sqlite');

// Initialize database on first import
let dbInitialized = false;
const initPromise = initDb().then(() => {
    dbInitialized = true;
    console.log('Database initialized');
});

module.exports = {
    query: async (...args) => {
        if (!dbInitialized) await initPromise;
        return query(...args);
    },
    initDb,
    saveDb,
    getDb
};
