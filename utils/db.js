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
    const users = await this.db.collection('users').find().toArray();
    return users.length;
  }

  async nbFiles() {
    const files = await this.db.collection('files').find().toArray();
    return files.length;
  }
}

const dbClient = new DBClient();
export default dbClient;
