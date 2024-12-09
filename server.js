import express from 'express';
import router from './utils/routes/index';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use('/', router);
app.listen(port);

export default app;
