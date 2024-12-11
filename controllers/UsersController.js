import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(request, response) {
    const { email } = request.body;
    const { password } = request.body;
    if (!email) {
      return response.status(400).send({ error: 'Missing email' });
    }
    if (!password) {
      return response.status(400).send({ error: 'Missing password' });
    }
    const users = dbClient.db.collection('users');
    const user = await users.findOne({ email });
    if (user) {
      return response.status(400).send({ error: 'Already exists' });
    }

    const hash = crypto.createHash('sha1');
    hash.update(password);
    const SHA1 = hash.digest('hex');
    const obj = { email, password: SHA1 };
    users.insertOne(obj, (err, result) => {
      if (err) throw err;
      return response.status(200).send({
        id: result.insertedId,
        email,
      });
    });

    return null;
  }

  static async getMe(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const users = dbClient.db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    return response.status(200).send({ email: user.email, id: userId });
  }
}

export default UsersController;
