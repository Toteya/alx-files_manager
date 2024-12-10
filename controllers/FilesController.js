import fs from 'fs';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).send({ error: 'Unauthorized' });
      return null;
    }
    const {
      name, type, parentId, isPublic, data,
    } = request.body;
    if (!name) {
      response.status(400).send({ error: 'Missing name' });
      return null;
    }
    if (!type || !(['folder', 'file', 'image'].includes(type))) {
      // console.log('BODY: ', request.body)
      response.status(400).send({ error: 'Missing type' });
      return null;
    }
    if (!data && type !== 'folder') {
      response.status(400).send({ error: 'Missing data' });
      return null;
    }
    const files = dbClient.db.collection('files');
    if (parentId) {
      const file = await files.findOne({ parentId });
      if (!file) {
        response.status(400).send({ error: 'Parent not found' });
        return null;
      }
      if (file.type !== 'folder') {
        response.status(400).send({ error: 'Parent is not a folder' });
        return null;
      }
    }
    const filter = { name };
    const updateDoc = {
      $set: {
        owner: userId,
      },
    };
    files.updateOne(filter, updateDoc);
    // .catch((err) => console.log(err));
    if (type === 'folder') {
      const file = await files.insertOne({
        name, type, parentId, isPublic, data,
      });
      response.status(201).end();
      return file;
    }
    const localPath = `./${name}`;
    FilesController.createFile(localPath, data);
    files.insertOne({
      userId, name, type, parentId, isPublic, data, localPath,
    })
      .then((file) => {
        response.status(201).end();
        return file;
      });
    return null;
  }

  static async createFile(path, contentBase64) {
    const buff = Buffer.from(contentBase64, 'base64');
    const content = buff.toString('utf-8');
    return fs.writeFile(path, content, () => {});
  }
}

export default FilesController;
