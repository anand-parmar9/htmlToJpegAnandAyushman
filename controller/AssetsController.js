import puppeteer from "puppeteer";
import fs from 'fs';


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
        console.log("Rendering the .a4 flyer container to A4 PNG...");
        const html = req.body?.html;

        if (!html) {
            return res.status(400).json({
                success: false,
                message: "Missing 'html' field in request body.",
            });
        }

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });

            const page = await browser.newPage();
            const mmToPx = (mm, dpi = 900) => (mm / 25.4) * dpi;

            // :one: Load the HTML
            await page.setContent(html, { waitUntil: "networkidle0" });

            // :two: Wait for main flyer container (.a4)
            let a4Found = null;
            try {
                a4Found = await page.waitForSelector(".a4", { visible: true, timeout: 10000 });
            } catch {
                console.warn("⚠️ Warning: .a4 element not found — using <body> instead.");
            }

            // :three: Convert millimeters → pixels
            const widthPx = Math.round(mmToPx(210)); // ~2480 px at 300 DPI

            const flyerHeight = await page.evaluate(() => {
                const el = document.querySelector(".a4") || document.body;
                return el ? el.scrollHeight : document.body.scrollHeight;
            });

            const heightPx = Math.round(flyerHeight);
            console.log(`📐 A4 size: ${widthPx} × ${heightPx} px`);

            // :four: Set viewport to A4 size
            await page.setViewport({
                width: widthPx,
                height: heightPx,
                deviceScaleFactor: 1,
            });

            // :five: Ensure white background
            await page.evaluate(() => {
                document.body.style.margin = "0";
                document.body.style.background = "#FFFFFF";
                const a4 = document.querySelector(".a4");
                if (a4) {
                    a4.style.margin = "0";
                    a4.style.background = "#FFFFFF";
                }
            });

            // :six: Get bounding box of flyer (fallback to body)
            const rect = await page.evaluate(() => {
                const el = document.querySelector(".a4") || document.body;
                const box = el.getBoundingClientRect();
                return { x: box.x, y: box.y, width: box.width, height: box.height };
            });

            // :seven: Clip screenshot exactly to that region
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

            // :eight: Convert Base64 → Binary
            const buffer = Buffer.from(base64Image, "base64");

            // Optional — save locally
            const filePath = "flyer-A4.png";
            fs.writeFileSync(filePath, buffer);

            await browser.close();

            return res.json({
                success: true,
                message: "Rendered flyer to A4 size successfully",
                width_px: widthPx,
                height_px: heightPx,
                file_name: filePath,
                base64: `${base64Image}`,
            });
        } catch (error) {
            console.error("Rendering error:", error);
            if (browser) await browser.close();
            return res.status(500).json({
                success: false,
                message: error.message,
            });
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