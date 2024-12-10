import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
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
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;
    if (!name) {
      response.status(400).send({ error: 'Missing name' });
      return null;
    }
    if (!type || !(['folder', 'file', 'image'].includes(type))) {
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
    if (type === 'folder') {
      files.insertOne({
        name,
        type,
        parentId,
        isPublic,
      })
        .then((result) => {
          response.status(201).send(result.ops[0]);
        });
      return null;
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPath = path.join(folderPath, uuidv4());
    FilesController.createFile(localPath, data);
    files.insertOne({
      userId,
      name,
      type,
      parentId,
      isPublic,
      localPath,
    })
      .then((result) => {
        response.status(201).send(result.ops[0]);
      });
    return null;
  }

  static async createFile(localPath, contentBase64) {
    const dir = path.dirname(localPath);
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        console.log(err);
      } else {
        const buff = Buffer.from(contentBase64, 'base64');
        const content = buff.toString('utf-8');
        fs.writeFile(localPath, content, (err) => {
          if (err) console.log(err);
        });
      }
    });
  }
}

export default FilesController;
