import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../db';
import redisClient from '../redis';

class AuthController {
  static async getConnect(request, response) {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      response.status(401).send({ error: 'Unauthorized' });
      return null;
    }
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8').split(':');
    const email = auth[0];
    const password = auth[1];

    const hash = crypto.createHash('sha1');
    hash.update(password);
    const hashedPwd = hash.digest('hex');
    const users = dbClient.db.collection('users');
    const user = await users.findOne({ email, password: hashedPwd });
    if (!user) {
      response.status(401).send({ error: 'Unauthorized' });
      return null;
    }
    const token = uuidv4();
    const key = `auth_${token}`;
    redisClient.set(key, user._id.toString(), 86400)
      .then(() => {
        response.status(200).send({ token });
      });
    return null;
  }

  static async getDisconnect(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    redisClient.get(key)
      .then((userId) => {
        if (!userId) {
          response.status(401).send({ error: 'Unauthorized' });
        } else {
          redisClient.del(key);
          response.status(204).end();
        }
        return null;
      });
  }
}

export default AuthController;
