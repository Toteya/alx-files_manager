import redis from 'redis';

class RedisClient {
  constructor() {
    this.isConnected = false;
    this.isConnecting = true;
    this.client = redis.createClient();
    // console.log('redis client is connecting... please wait');
    this.client
      .on('error', (err) => {
        this.isConnecting = false;
        console.log(err);
        throw err;
      })
      .on('ready', () => {
        this.isConnecting = false;
        this.isConnected = true;
        // console.log('redis client is connected successfully');
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', duration, (err, reply) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, reply) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }
}

const redisClient = new RedisClient();
export default redisClient;
