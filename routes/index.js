import express from "express";
import { assetsController } from "../controller/AssetsController.js";
const apiRoutes = express.Router();

apiRoutes.post('/shipment', (req, res) => {
    assetsController.convertHtmlToPdf(req, res)
});

apiRoutes.post('/scrape', (req, res) => {
    assetsController.scrapeUrls(req, res)
});
apiRoutes.post('/htmlTojpeg', (req, res) => {
    assetsController.htmlToJpeg(req, res)
});
export default apiRoutes;