const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'milestomemories.db');
let db = null;

// Initialize database
async function initDb() {
    const SQL = await initSqlJs();

    try {
        // Try to load existing database
        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            db = new SQL.Database(fileBuffer);
            console.log('Loaded existing database');
        } else {
            db = new SQL.Database();
            console.log('Created new database');
        }
    } catch (err) {
        console.log('Creating new database');
        db = new SQL.Database();
    }

    return db;
}

// Save database to file
function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Helper to make it compatible with pg-style queries
const query = async (sql, params = []) => {
    if (!db) {
        await initDb();
    }

    try {
        // Convert $1, $2 style params to ? style
        let convertedSql = sql;
        let paramIndex = 1;
        while (convertedSql.includes(`$${paramIndex}`)) {
            convertedSql = convertedSql.replace(`$${paramIndex}`, '?');
            paramIndex++;
        }

        // Handle RETURNING clause (not supported in SQLite)
        const isReturning = convertedSql.toUpperCase().includes('RETURNING');
        const isInsert = convertedSql.trim().toUpperCase().startsWith('INSERT');
        const isSelect = convertedSql.trim().toUpperCase().startsWith('SELECT');

        if (isReturning) {
            // Remove RETURNING clause and get table name
            const mainSql = convertedSql.replace(/RETURNING\s+.+$/i, '').trim();
            const tableName = mainSql.match(/INTO\s+(\w+)/i)?.[1] ||
                             mainSql.match(/UPDATE\s+(\w+)/i)?.[1];

            db.run(mainSql, params);
            saveDb();

            if (isInsert && tableName) {
                // Get the last inserted row
                const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
                if (lastId) {
                    const result = db.exec(`SELECT * FROM ${tableName} WHERE id = ${lastId}`);
                    if (result.length > 0) {
                        const columns = result[0].columns;
                        const values = result[0].values[0];
                        const row = {};
                        columns.forEach((col, i) => row[col] = values[i]);
                        return { rows: [row] };
                    }
                }
            }
            return { rows: [] };
        }

        if (isSelect) {
            const result = db.exec(convertedSql, params);
            if (result.length === 0) {
                return { rows: [] };
            }
            const columns = result[0].columns;
            const rows = result[0].values.map(values => {
                const row = {};
                columns.forEach((col, i) => row[col] = values[i]);
                return row;
            });
            return { rows };
        } else {
            db.run(convertedSql, params);
            saveDb();
            return { rows: [], rowCount: db.getRowsModified() };
        }
    } catch (error) {
        console.error('SQL Error:', error.message);
        console.error('Query:', sql);
        console.error('Params:', params);
        throw error;
    }
};

module.exports = { initDb, query, saveDb, getDb: () => db };
