import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
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
        .then((result) => response.status(201).send(result.ops[0]));
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
      .then((result) => response.status(201).send(result.ops[0]));
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
      // console.log(JSON.stringify(results, null, 2));
      return response.status(200).send(results[0].data);
    } catch (err) {
      console.log(err);
      return response.status(500).end();
    }
  }

  static async putPublish(request, response) {
    const makePublic = true;
    return FilesController.publish(request, response, makePublic);
  }

  static async putUnpublish(request, response) {
    const makePublic = false;
    return FilesController.publish(request, response, makePublic);
  }

  static async publish(request, response, makePublic) {
    // Called by endpoints putPublish and putUnpublish
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const files = dbClient.db.collection('files');

    // Update the document
    const filter = { _id: ObjectId(id), userId };
    const updateDoc = {
      $set: {
        isPublic: makePublic,
      },
    };
    const options = { returnDocument: 'after' };

    files.findOneAndUpdate(filter, updateDoc, options)
      .then((result) => {
        const file = result.value;
        if (!file) {
          return response.status(404).send({ error: 'Not found' });
        }
        return response.status(200).send(file);
      });
    return null;
  }

  static async getFile(request, response) {
    const token = request.headers['x-token'];
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    const { id } = request.params;
    const files = dbClient.db.collection('files');

    files.findOne({ _id: ObjectId(id) })
      .then((file) => {
        if (!file) {
          return response.status(404).send({ error: 'Not found' });
        }
        if (!file.isPublic && (!userId || userId !== file.userId)) {
          // console.log('FILE NOT FOUND!!!')
          return response.status(404).send({ error: 'Not found' });
        }
        if (file.type === 'folder') {
          return response.status(400).send({ error: 'A folder doesn\'t have content' });
        }
        if (!fs.existsSync(file.localPath)) {
          return response.status(404).send({ error: 'Not found' });
        }
        FilesController.readFileData(file.localPath)
          .then((data) => {
            const mimeType = mime.contentType(file.name);
            response.setHeader('Content-Type', mimeType);
            return response.status(200).send(data);
          })
          .catch((err) => console.log(err));
        return null;
      });
    return null;
  }

  static async createFile(localPath, contentBase64) {
    // Called by endpoint postUpload - Creates a new file in the given path.
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

  static async readFileData(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}

export default FilesController;
