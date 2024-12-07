import redis from 'redis';

class RedisClient {
  constructor() {
    this.isConnected = false;
    this.client = redis.createClient();
    console.log('client is connecting ... please wait');
    this.client
      .on('error', (err) => {
        console.log(err)
        reject(err);
      })
      .on('ready', () => {
        this.isConnected = true;
        console.log('client is connected successfully');
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    return await new Promise((resolve, reject) => {
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
      })
    });;
  }
}

const redisClient = new RedisClient();
export default redisClient;
