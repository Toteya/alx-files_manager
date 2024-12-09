import crypto from 'crypto';
import dbClient from '../db';

class UsersController {
  static async postNew(request, response) {
    const { email } = request.body;
    const { password } = request.body;
    if (!email) {
      response.status(400).send('Missing email');
      return null;
    }
    if (!password) {
      response.status(400).send('Missing password');
      return null;
    }
    const users = dbClient.db.collection('users');
    const user = await users.find({ email }).toArray();
    if (user.length !== 0) {
      response.status(400).send('Already exists');
      return null;
    }
    const hash = crypto.createHash('sha1');
    hash.update(password);
    const SHA1 = hash.digest('hex');
    const obj = { email, password: SHA1 };
    users.insertOne(obj, (err, result) => {
      if (err) throw err;
      response.status(200).send({
        id: result.insertedId,
        email,
      });
    });
    return null;
  }
}

export default UsersController;
