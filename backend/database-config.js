require('dotenv').config();

const dbConfig = {
  host: 'dpg-d6ntf495pdvs73ftn54g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'planificador_db_j33z',
  user: 'planificador_db_j33z_user',
  password: 'scNosIHVNoqalO6JGeF2pZJz36C5gPdt',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

module.exports = dbConfig;