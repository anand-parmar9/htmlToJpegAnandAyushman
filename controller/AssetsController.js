import pkg from 'lodash';
const { template } = pkg;
import axios from "axios";
import puppeteer from "puppeteer";


class AssetsController {
    constructor() { }


    async convertHtmlToPdf(htmlContent, res) {
        // Launch browser
        
        const browser = await puppeteer.launch({ headless: true });
        
        const page = await browser.newPage();
        
        // Set HTML content
        await page.setContent(htmlContent.body.html, { waitUntil: "networkidle0" });
        
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
        const heightInInches = bodyHeight / 96;
        const widthInInches = 8.27; // A4 width in inches
        
        // Generate PDF
        const pdfBuffer = await page.pdf({
        width: `${widthInInches}in`,
        height: `${heightInInches}in`,
        printBackground: true,
        pageRanges: "1",
        });
        const a=Buffer.from(pdfBuffer).toString("base64");
        res.json({data:a})
        await browser.close();
        return pdfBuffer;
    }

    // ---------------- Controller Function ----------------
   



    
    

    

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