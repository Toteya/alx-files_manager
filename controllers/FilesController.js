import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;

    if (!name) {
      return response.status(400).send({ error: 'Missing name' });
    }
    if (!type || !(['folder', 'file', 'image'].includes(type))) {
      return response.status(400).send({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return response.status(400).send({ error: 'Missing data' });
    }

    const files = dbClient.db.collection('files');
    if (parentId) {
      const file = await files.findOne({ _id: ObjectId(parentId) });
      if (!file) {
        return response.status(400).send({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return response.status(400).send({ error: 'Parent is not a folder' });
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
          return response.status(201).send(result.ops[0]);
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
        return response.status(201).send(result.ops[0]);
      });
    return null;
  }

  static async getShow(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const files = dbClient.db.collection('files');
    files.findOne({ _id: ObjectId(id), userId })
      .then((file) => {
        if (!file) {
          return response.status(404).send({ error: 'Not found' });
        }
        return response.status(200).send(file);
      });
    return null;
  }

  static async getIndex(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    // Get query parameters
    let {
      parentId = 0,
      page = '0',
    } = request.query;

    if (parentId === '0') {
      parentId = parseInt(parentId, 10);
    }
    page = parseInt(page, 10);
    const files = dbClient.db.collection('files');

    // Retrieve data from DB with pagination
    const pageSize = 20;
    try {
      console.log('PARENT ID: ', parentId);
      const matchStage = parentId ? { parentId } : {};
      const pipeline = [
        {
          $match: matchStage,
        },
        {
          $facet: {
            metadata: [{ $count: 'totalCount' }],
            data: [
              { $skip: (page) * pageSize },
              { $limit: pageSize },
            ],
          },
        },
      ];
      const results = await files.aggregate(pipeline).toArray();
      console.log(JSON.stringify(results, null, 2));
      return response.status(200).send(results[0].data);
    } catch (err) {
      console.log(err);
      return response.status(500).end();
    }
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
