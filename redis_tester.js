import redis from 'redis';
// import { get } from 'request';

const client = redis.createClient();
client.on('ready', () => console.log('Client created.'));
console.log('Waiting ...');

client.set('name', 'Toteya');

const get = async (key) => new Promise((resolve) => {
  client.get(key, (err, reply) => {
    resolve(reply);
  });
});

get('name').then((value) => console.log(value));
// console.log(value);
