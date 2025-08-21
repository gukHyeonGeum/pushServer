const mysql = require('mysql');
const mybatisMapper = require('mybatis-mapper');

const read_conn = mysql.createPool({
	multipleStatements: true,
	host     : process.env.READ_DB_URL,
	user     : process.env.READ_DB_USER,
	password : process.env.READ_DB_PASSWORD,
	database : process.env.READ_DB_ALIAS,
	dateStrings: 'date',
	charset: process.env.READ_DB_CHARSET,
	connectionLimit: process.env.READ_DB_CONNECTIONLIMIT,
	waitForConnections:true
});

const write_conn = mysql.createPool({
	multipleStatements: true,
	host     : process.env.MASTER_DB_URL,
	user     : process.env.MASTER_DB_USER,
	password : process.env.MASTER_DB_PASSWORD,
	database : process.env.MASTER_DB_ALIAS,
	dateStrings: 'date',
	charset: process.env.MASTER_DB_CHARSET,
	connectionLimit: process.env.MASTER_DB_CONNECTIONLIMIT,
	waitForConnections:true
});

mybatisMapper.createMapper([
    './mappers/readmapper/user.readmapper.xml',
    './mappers/iomapper/user.iomapper.xml',
    './mappers/readmapper/pushmngr.readmapper.xml',
    './mappers/iomapper/pushmngr.iomapper.xml',
    './mappers/readmapper/common.readmapper.xml',
]);

function getPoolForMapper(mapper) {
    return mapper.toLowerCase().endsWith('iomapper') ? write_conn : read_conn;
}

async function executeQuery(mapper, id, params) {
    let connection;
    try {
		const dbConnect = getPoolForMapper(mapper);

		const sql = mybatisMapper.getStatement(mapper, id, params, { language: 'sql', indent: '  ' });

        connection = await new Promise((resolve, reject) => {
            dbConnect.getConnection((err, conn) => {
                if (err) return reject(err);
                resolve(conn);
            });
        });

        const rows = await new Promise((resolve, reject) => {
            connection.query(sql, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        return rows;
    } catch (error) {
        console.error(`Database query error in ${mapper}#${id}:`, error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    executeQuery
};