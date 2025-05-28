
import express from 'express';
import pdfRoutes from './services/pdf/routes';
import zplRoutes from './services/zpl/routes';
import emailRoutes from './services/email/routes';

const app = express();
app.use(express.json());

app.use('/pdf', pdfRoutes);
app.use('/zpl', zplRoutes);
app.use('/email', emailRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`core-services listening on port ${PORT}`);
});
