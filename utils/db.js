import { MongoClient } from 'mongodb';

const port = process.env.DB_PORT || 27017;
const host = process.env.DB_HOST || 'localhost';
const dbName = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.isConnected = false;
    this.client.connect()
      .then(() => {
        this.db = this.client.db(dbName);
        this.isConnected = true;
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    return this.db.collection('users').length;
  }

  async nbFiles() {
    return this.db.collection('files').length;
  }
}

const dbClient = new DBClient();
export default dbClient;
