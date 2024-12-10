import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(request, response) {
    response.status(200).send({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static getStats(request, response) {
    response.status(200).send({
      users: dbClient.nbUsers(),
      files: dbClient.nbFiles(),
    });
  }
}

export default AppController;
