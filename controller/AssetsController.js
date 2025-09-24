import fs from 'fs';
import pkg from 'lodash';
const { template } = pkg;
import { generatePdfService } from './GeneratePdfService.js';
import path from "path";
import axios from "axios";
import puppeteer from "puppeteer";

class AssetsController {
    constructor() { }


    async convertHtmlToPdf(htmlContent, options = {}) {
        // Launch browser
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Set HTML content
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        // If options.format === 'thermal', you can adjust width/height
        let width = options.width || "8.27in"; // default A4 width
        let height;

        if (options.format === "thermal") {
            width = "4in";
            height = "6in"; // example thermal size
        } else {
            // calculate height based on content
            const bodyHeight = await page.evaluate(() => {
                return Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
            });
            height = `${bodyHeight / 96 + 0.2}in`; // px -> inch
        }

        // Generate PDF
        const pdfBuffer = await page.pdf({
            width,
            height,
            printBackground: options.printBackground ?? true,
            margin: options.margin ?? { top: "5mm", bottom: "5mm", left: "5mm", right: "5mm" },
            pageRanges: options.pageRanges || "1",
        });

        await browser.close();
        return pdfBuffer;
    }

    // ---------------- Controller Function ----------------
    async generateLabel(req, res) {
        try {

            const format = req.body.format === "thermal" ? "thermal" : "a4";
            // Fetch settings (your custom function)
            const settings = await this.getLabelMasterSettings(req, res);

            const options = {
                format,
                printBackground: true,
                margin: { left: "4mm", right: "4mm", top: "5mm", bottom: "5mm" },
            };


            const pdfContent = req.body.html



            // Generate PDF buffer
            const buffer = await generatePdfService.convertHtmlToPdf(pdfContent, options);
            const pdfBase641 = Buffer.from(buffer).toString("base64");
            const pdfBase64 = buffer.toString("base64");
            return res.status(200).json({ pdfBase641 });
        } catch (err) {
            console.log(": AssetsController_generateLabel_error: " + err.message);
            return res.status(400).json({ error: err.message });
        }
    }


    async generateManifest(req, res) {
        let request_id = req.body.request_id;

        const errors = validationResult(req).formatWith(({ msg }) => msg);
        if (!errors.isEmpty()) {
            return validationError(res, errors.array().toString());
        }

        try {
            const dir_name = 'manifest';
            const data = this.removeNullValues(req.body.data); // Assuming `this.removeNullValues` is a method from your class/context

            // Define PDF options
            let options = {
                format: 'a4',
                printBackground: true,
                margin: {
                    left: '10mm',
                    right: '10mm',
                    top: '13mm',
                    bottom: '10mm'
                }
            };

            // Read the HTML template file
            const html_template = fs.readFileSync(path.resolve('src/templates/pdf/manifest.html'), 'utf-8');
            // Generate HTML content by passing the data into the template
            const template_call = template(html_template);
            const pdf_content = template_call(data);
            // Generate the PDF from the HTML content
            const calculatePDF_create_time = ": AssetsController_getPDFLink_pdf_generateManifest_time";
            const buffer = await generatePdfService.convertHtmlToPdf(pdf_content, options);

            // Generate a random PDF filename and upload it to AWS S3
            const pdfFileName = nowTimeSpan() + "-" + getRandomInteger(99999, 11111) + '.pdf';
            const file = { name: pdfFileName, buffer };
            const pdf_url = await awsS3Provider.uploadFile(file, dir_name, file.name);

            // Send the URL back to the client
            return successRes(res, pdf_url, HttpStatusCode.OK);

        } catch (err) {
            // Handle any errors
            return errorRes(res, err.message, HttpStatusCode.BAD_REQUEST);
        }
    }

    async generateOrderInvoice(req, res) {
        let request_id = req.body.request_id;

        const errors = validationResult(req).formatWith(({ msg }) => msg);
        if (!errors.isEmpty()) {
            // console.log(request_id + ": index_validation_error: " + JSON.stringify(errors.array().toString()));
            return validationError(res, errors.array().toString());
        }

        try {

            const dir_name = 'order_invoice';
            const data = this.removeNullValues(req.body.data);

            let options = { format: 'a4', printBackground: true, margin: { left: '3mm', right: '3mm', top: '3mm', bottom: '5mm' } };

            const html_template = fs.readFileSync(path.resolve(`src/templates/pdf/order_invoice.html`), 'utf-8');

            const template_call = template(html_template);
            // const template_call = template(html_template); // Correct syntax


            const pdf_content = template_call({ shipments: data });


            const calculatePDF_create_time = ": AssetsController_getPDFLink_pdf_generateLabel_time";
            // console.time(calculatePDF_create_time);
            const buffer = await generatePdfService.convertHtmlToPdf(pdf_content, options);
            // console.timeEnd(calculatePDF_create_time);
            const pdfFileName = nowTimeSpan() + "-" + getRandomInteger(99999, 11111) + '.pdf';


            const file = { name: pdfFileName, buffer };
            const pdf_url = await awsS3Provider.uploadFile(file, dir_name, file.name);
            return successRes(res, pdf_url, HttpStatusCode.OK);

        } catch (err) {
            return errorRes(res, err.message, HttpStatusCode.BAD_REQUEST);
        }
    }

    async getLabelMasterSettings(req, res) {
        try {
            const { MASTER_LABLE_SETTING_SERVICE } = process.env;
            const { user_id, token } = req.body;
            // console.log('user_id', user_id, token);
            const settingsRes = await axios.post(`${MASTER_LABLE_SETTING_SERVICE}find`, { user_id },
                {
                    headers: {
                        'Authorization': `${token}`,
                    }
                });
            return settingsRes?.data?.status ? settingsRes.data.data : false;
        } catch (error) {
            // console.log(" AssetsController_getLabelMasterSettings_error: " + error.message, error?.response?.data);
            return false;
        }

    }

    removeNullValues(obj) {
        if (Array.isArray(obj)) {
            return obj.map((item) => (item === null ? '' : this.removeNullValues(item)));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                const value = this.removeNullValues(obj[key]);
                result[key] = value === null ? '' : value;
            }
            return result;
        } else {
            return obj;
        }
    }

    /* 
    async generatePDFLink(req: Request, res: Response) {
        let request_id = req.body.request_id;

        const errors = validationResult(req).formatWith(({ msg }) => msg);
        if (!errors.isEmpty()) {
            // console.log(request_id + ": index_validation_error: " + JSON.stringify(errors.array().toString()));
            return validationError(res, errors.array().toString());
        }

        try {
            const pdf_type = req.body.pdf_type;
            const dir_name = req.body.dir_name || pdf_type;
            const data = req.body.data;
            const format = req.body.format || 'a4';
            
            let options: any = { format: format, printBackground: true };
            switch (pdf_type) {
                case "manifest":
                    options.margin = { left: '10mm', right: '10mm', top: '13mm', bottom: '10mm' };
                    break;
                case "order_invoice":
                    options.margin = { left: '3mm', right: '3mm', top: '3mm', bottom: '5mm' };
                    break;
            }

            const link = await this.getPDFLink({ pdf_type, dir_name, courier, format, data }, options);
            return successRes(res, link, HttpStatusCode.OK);

        } catch (err) {
            // console.log(request_id + ": AssetsController_generatePDFLink_error: " + err.message);
            return errorRes(res, err.message, HttpStatusCode.BAD_REQUEST);
        }
    }

    async getPDFLink(pdfLinkObj: PDFLinkObj, options: any) {
        try {
            const { pdf_type, dir_name, courier, data, format } = pdfLinkObj;

            const html_template = fs.readFileSync(path.resolve(`src/templates/pdf/${pdf_type}.html`), 'utf-8');
            const template_call: any = template(html_template);
            const pdf_content = template_call(data);

            const calculatePDF_create_time = ": AssetsController_getPDFLink_pdf_create_time";
            // console.time(calculatePDF_create_time);
            const buffer = await generatePdfService.convertHtmlToPdf(pdf_content, options);
            // console.timeEnd(calculatePDF_create_time);
            const pdfFileName = nowTimeSpan() + "-" + getRandomInteger(99999, 11111) + '.pdf';
            // fs.writeFileSync(pdfFileName, buffer);

            const file = { name: pdfFileName, buffer };
            const pdf_url: any = await awsS3Provider.uploadFile(file, dir_name);
            return pdf_url;
        } catch (err) {
            // console.log(" AssetsController_getPDFLink_error: " + err.message);
            return false;
        }
    }
    */


    // pick list

    async generatePickList(req, res) {
        let request_id = req.body.request_id;

        const errors = validationResult(req).formatWith(({ msg }) => msg);
        if (!errors.isEmpty()) {
            console.log(request_id + ": index_validation_error: " + JSON.stringify(errors.array().toString()));
            return validationError(res, errors.array().toString());
        }

        try {
            const dir_name = 'assets/labels';
            const data = await shipmentService.totalselectedorders(req.body.ids);
            const orderIds = data.map(data => data.order_id);

            if (!orderIds) {
                console.log(request_id + ": AssetsController_generateLabel_error: " + JSON.stringify(orderIds));
                return errorRes(res, "No Record Found", HttpStatusCode.BAD_REQUEST);
            }


            const picklists = await shipmentService.getByShipingid(orderIds);

            // console.log(data.length,"=picklists==",picklists);

            const format = 'a4';
            console.log('req.body_format', format);


            let options = { format: format, printBackground: true, margin: { left: '4mm', right: '4mm', top: '5mm', bottom: '5mm' } };
            let pdf_content;
            pdf_content = await getPickListHtml(picklists, data.length, format);


            const calculatePDF_create_time = ": AssetsController_getPickListPDFLink_pdf_generateLabel_time";
            console.time(calculatePDF_create_time);
            const buffer = await generatePdfService.convertHtmlToPdf(pdf_content, options);
            console.timeEnd(calculatePDF_create_time);
            const pdfFileName = nowTimeSpan() + "-" + getRandomInteger(99999, 11111) + '.pdf';


            const file = { name: pdfFileName, buffer };
            const pdf_url = await awsS3Provider.uploadFile(file, dir_name, file.name);
            // res.status(200).send(pdf_content);
            return successRes(res, pdf_url, HttpStatusCode.OK);

        } catch (err) {
            console.log(request_id + ": AssetsController_generateLabel_error: " + err.message);
            console.log('asset_input_data', JSON.stringify(req.body.data));
            return errorRes(res, err.message, HttpStatusCode.BAD_REQUEST);
        }
    }
}

export const assetsController = new AssetsController();

// interface PDFLinkObj {
// 	pdf_type: string,
// 	dir_name: string,
// 	courier: string,
// 	format: string,
// 	data: any
// }


const pdfLinkObj = {
    pdf_type: "invoice",
    dir_name: "invoices",
    courier: "DHL",
    format: "A4",
    data: { someKey: "someValue" }
};