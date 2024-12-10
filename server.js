import express from 'express';
import router from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// Allow for JSON data and Handle large payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/', router);

app.listen(port);

export default app;
