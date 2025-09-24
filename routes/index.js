import express from "express";
import { assetsController } from "../controller/AssetsController.js";
const apiRoutes = express.Router();

apiRoutes.post('/shipment', (req, res) => {
    assetsController.convertHtmlToPdf(req, res)
});

export default apiRoutes;