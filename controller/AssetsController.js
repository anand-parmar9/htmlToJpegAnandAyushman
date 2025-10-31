import puppeteer from "puppeteer";
import fs from 'fs';
import path from "path";


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
        const a = Buffer.from(pdfBuffer).toString("base64");
        res.json({ data: a })
        await browser.close();
        return pdfBuffer;
    }

    async htmlToJpeg1(req, res) {
        try {
            const { html, type = "png" } = req.body;
            console.log(req.body)

            if (!req.body) {
                return res.status(400).json({ status: "error", message: "HTML is required" });
            }

            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();

            await page.setContent(req.body, { waitUntil: "networkidle0" });


            const buffer = await page.screenshot({
                type: type === "jpeg" ? "jpeg" : "png",
                fullPage: true
            });

            await browser.close();
            const bufferData = Array.from(buffer);
            const buffer1 = Buffer.from(bufferData);

            const base64String = buffer1.toString("base64");
            return res.status(200).json({
                status: "success",
                message: `HTML converted to ${type.toUpperCase()} successfully`,
                bufferData: base64String
            });

        } catch (error) {
            console.error("Error converting HTML:", error);
            return res.status(500).json({ status: "error", message: error.message });
        }
    }


    async htmlToJpeg(req, res) {
        try {
            const htmlContent = req.body.html;
            const mmToPx = (mm, dpi = 300) => (mm / 25.4) * dpi;
            if (!htmlContent) {
                return res.status(400).json({ status: "error", message: "Missing 'html' in body" });
            }

            console.log(" Rendering the .a4 flyer container to A4 PNG.");

            const chromePath = path.resolve("./puppeteer_cache/chrome/linux-131.0.6778.204/chrome-linux64/chrome");

            const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: "networkidle0" });

            await page.waitForSelector(".a4", { visible: true });

            const widthPx = Math.round(mmToPx(210)); 
            const flyerHeight = await page.evaluate(() => {
                const el = document.querySelector(".a4");
                return el ? el.scrollHeight : document.body.scrollHeight;
            });
            const heightPx = Math.round(flyerHeight);

            console.log(`A4 size: ${widthPx} × ${heightPx}px`);

            await page.setViewport({
                width: widthPx,
                height: heightPx,
                deviceScaleFactor: 1,
            });

            await page.evaluate(() => {
                document.body.style.margin = "0";
                document.body.style.background = "#FFF";
                const a4 = document.querySelector(".a4");
                if (a4) {
                    a4.style.margin = "0";
                    a4.style.background = "#FFF";
                }
            });

            const rect = await page.evaluate(() => {
                const el = document.querySelector(".a4");
                if (!el) return { x: 0, y: 0, width: 0, height: 0 };
                const box = el.getBoundingClientRect();
                return { x: box.x, y: box.y, width: box.width, height: box.height };
            });

            const base64Image = await page.screenshot({
                type: "png",
                encoding: "base64",
                clip: {
                    x: rect.x,
                    y: rect.y,
                    width: Math.min(rect.width, widthPx),
                    height: Math.min(rect.height, heightPx),
                },
                omitBackground: false,
            });

            await browser.close();

            const outputPath = "flyer-A4.png";
            fs.writeFileSync(outputPath, Buffer.from(base64Image, "base64"));

            return res.json({
                status: "success",
                message: "Rendered flyer to A4 successfully",
                width_px: widthPx,
                height_px: heightPx,
                file_saved: outputPath,
                base64: `data:image/png;base64,${base64Image}`,
            });
        } catch (err) {
            console.log(" Rendering error:", err);
            return res.status(500).json({ status: "error", message: err.message });
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

}

export const assetsController = new AssetsController();

const pdfLinkObj = {
    pdf_type: "invoice",
    dir_name: "invoices",
    courier: "DHL",
    format: "A4",
    data: { someKey: "someValue" }
};