import puppeteer from 'puppeteer';

class GeneratePdfService {
    DEFAULT_OPTIONS;
    browser;
    page;
    thermalPageSize;
    
    constructor() {
        console.log("1.......")
        const customPageSize = {
            width: '4in',
            height: '6in',
        };

        this.thermalPageSize = {
            width: '4in',
            height: '6in',
        };

        this.DEFAULT_OPTIONS = {
            format: 'A4',
            margin: {
                left: '13mm',
                right: '13mm',
                top: '14mm',
                bottom: '14mm',
            },
        };

        this.browser = null;
        this.page = null;

        this.launchBrowser(); // Launch the browser during object creation
    }

    async launchBrowser() {
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--hide-scrollbars',
                    '--disable-gpu',
                    '--full-memory-crash-report'
                ],
            });
            console.log('GeneratePdfService Browser is launched');
        } catch (error) {
            console.log('Error GeneratePdfService_launchBrowser: ' + error.message);
        }

    }

    async newPage() {
        try {
            if (!this.page) {
                this.page = await this.browser.newPage();
            } else {
                await this.page.setContent('');
            }

        } catch (error) {
            await this.page.close();
            this.page = await this.browser.newPage();
            console.log('Error GeneratePdfService_newPage: ' + error.message);
        }
    }

    async convertHtmlToPdf(htmlContent, option = {}) {
        try {
            if (!this.browser) {
                const calculatePDF_browser_launchBrowser_time = "pdf_browser.launchBrowser_time";
                await this.launchBrowser();
            }
    
            const calculatePDF_browser_newPage_time = "pdf_browser.newPage_time";
            await this.newPage();
    
            const calculatePDF_setContent_time1 = "pdf_page.setContent__time";
            await this.page.setContent(htmlContent);
    
            let pOptions = { ...this.DEFAULT_OPTIONS, ...option };
            if (pOptions.format === 'thermal') {
                pOptions = { ...pOptions, ...this.thermalPageSize };
                delete pOptions.format;
            }
            const calculatePDF_page_pdf_time = "pdf_page.pdf_time";
            const pdfBuffer = await this.page.pdf(pOptions);
            await this.closeBrowser();

            return pdfBuffer;
        } catch (error) {
            console.log('Error GeneratePdfService_convertHtmlToPdf : ' + error.message);
            await this.closeBrowser();
            return false;
        }
    }

    async closeBrowser() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
                console.log('GeneratePdfService Page closed set to null');
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                console.log('GeneratePdfService Browser closed set to null');
            }
        } catch (error) {
            console.log('Error GeneratePdfService_closeBrowser : ' + error.message);
        }
    }
}

export const generatePdfService = new GeneratePdfService();