import puppeteer from "puppeteer";
import fs from 'fs';

class AssetsController {
    constructor() { }


    async convertHtmlToPdf(htmlContent, res) {
        // Launch browser

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        })

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

    async scrapeUrls(req, res) {
        const { url: propertyUrl } = req.body;
        if (!propertyUrl) {
            return res.status(400).json({
                status: "error",
                message: "Missing 'url' in request body",
            });
        }
        let browser;
        try {
            console.log(":globe_with_meridians: Navigating to URL:", propertyUrl);
            browser = await puppeteer.launch({
                headless: true,
                executablePath: '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            });
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(60000);
            const allImages = new Set();
            const allVideos = new Set();
            // --- Monitor Network Requests (Images / Videos / JSON/XHR) ---
            page.on("response", async (response) => {
                try {
                    const req = response.request();
                    const resUrl = req.url();
                    // Direct media detection
                    if (resUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i))
                        allImages.add(resUrl.split("?")[0]);
                    if (resUrl.match(/(youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.mov|\.m3u8)/i))
                        allVideos.add(resUrl.split("?")[0]);
                    // Parse JSON/XHR responses
                    if (["xhr", "fetch"].includes(req.resourceType())) {
                        const text = await response.text();
                        // Extract images
                        [...text.matchAll(/https?:\/\/[^"'\s>]+?\.(jpg|jpeg|png|gif|webp|avif)/gi)]
                            .forEach((m) => allImages.add(m[0]));
                        // Extract videos
                        [...text.matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)[A-Za-z0-9_\-?=]+/gi)]
                            .forEach((m) => allVideos.add(m[0]));
                    }
                } catch { }
            });
            // --- Open Page ---
            await page.goto(propertyUrl, { waitUntil: "networkidle2" });
            // --- Scroll to Load Lazy Images ---
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let total = 0;
                    const step = 400;
                    const timer = setInterval(() => {
                        window.scrollBy(0, step);
                        total += step;
                        if (total >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 250);
                });
            });
            // --- Collect DOM Media, Text & HTML ---
            const domData = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll("img"))
                    .flatMap((i) => [i.src, i.dataset.src, i.dataset.original, i.currentSrc])
                    .filter(Boolean);
                const bgImgs = Array.from(document.querySelectorAll("*"))
                    .map((el) => getComputedStyle(el).backgroundImage)
                    .filter((b) => b && b.startsWith("url("))
                    .map((b) => b.slice(4, -1).replace(/["']/g, ""));
                const iframes = Array.from(document.querySelectorAll("iframe"))
                    .map((f) => f.src)
                    .filter((u) => u && /(youtube\.com|youtu\.be|vimeo\.com)/i.test(u));
                const videos = Array.from(document.querySelectorAll("video source"))
                    .map((v) => v.src)
                    .filter(Boolean);
                const pageText = document.body.innerText || "";
                const pageHTML = document.documentElement.outerHTML || "";
                return { imgs, bgImgs, iframes, videos, pageText, pageHTML };
            });
            [...domData.imgs, ...domData.bgImgs].forEach((u) => allImages.add(u));
            [...domData.iframes, ...domData.videos].forEach((u) => allVideos.add(u));
            // --- Extract Embed YouTube URLs ---
            const embedVideos = await page.evaluate(() => {
                const urls = new Set();
                document.querySelectorAll("[data-embed-url]").forEach((el) => {
                    const embedUrl = el.getAttribute("data-embed-url");
                    if (embedUrl && /(youtube\.com|youtu\.be)/i.test(embedUrl)) urls.add(embedUrl);
                });
                document.querySelectorAll("iframe").forEach((iframe) => {
                    const src = iframe.getAttribute("src");
                    if (src && /(youtube\.com|youtu\.be)/i.test(src)) urls.add(src);
                });
                return [...urls];
            });
            embedVideos.forEach((u) => allVideos.add(u));
            // --- Extract Media from <script> tags ---
            const embedded = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll("script")).map((s) => s.innerText);
                const imageMatches = scripts.flatMap((t) =>
                    [...t.matchAll(/https?:\/\/[^"'\s>]+?\.(jpg|jpeg|png|gif|webp|avif)/gi)]
                        .map((m) => m[0])
                );
                const videoMatches = scripts.flatMap((t) =>
                    [...t.matchAll(/https?:\/\/[^"'\s>]+?(youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.mov)/gi)]
                        .map((m) => m[0])
                );
                return { imageMatches, videoMatches };
            });
            embedded.imageMatches.forEach((u) => allImages.add(u));
            embedded.videoMatches.forEach((u) => allVideos.add(u));
            // --- URL Normalizers ---
            function normalize(url) {
                if (!url) return null;
                try {
                    const u = new URL(url, propertyUrl);
                    return u.href.split("?")[0];
                } catch {
                    return null;
                }
            }
            function normalizeYouTube(link) {
                const idMatch = link.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
                return idMatch ? `https://www.youtube.com/watch?v=${idMatch[1]}` : normalize(link);
            }
            const cleanImages = [...allImages]
                .map(normalize)
                .filter(Boolean)
                .filter((v, i, arr) => arr.indexOf(v) === i);
            const cleanVideos = [...allVideos]
                .map(normalizeYouTube)
                .filter(Boolean)
                .filter((v, i, arr) => arr.indexOf(v) === i);
            await browser.close();
            // --- Final Response (n8n style) ---
            return res.json({
                status: "success",
                data: {
                    property_url: propertyUrl,
                    page_text: domData.pageText.slice(0, 20000),
                    page_html: domData.pageHTML,
                    image_count: cleanImages.length,
                    video_count: cleanVideos.length,
                    images: cleanImages,
                    videos: cleanVideos,
                },
            });
        } catch (err) {
            console.error(":x: Error scraping page:", err.message);
            if (browser) await browser.close();
            return res.status(500).json({
                status: "error",
                message: err.message,
            });
        }
    }
    async scrapeUrls1(req, res) {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                status: "error",
                message: "Missing 'url' in request body",
            });
        }

        let browser;
        try {
            console.log("🌐 Navigating to URL:", url);
            browser = await puppeteer.launch({
                headless: true,
                executablePath: '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]

            });

            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(60000);

            // Go to the target URL
            await page.goto(url, { waitUntil: "networkidle2" });

            // Wait until <body> is loaded
            await page.waitForSelector("body");

            // Extract the full HTML
            const html = await page.content();

            console.log("✅ Page loaded successfully");

            await browser.close();

            return res.json({
                status: "success",
                message: "Page scraped successfully",
                pageUrl: url,
                html,
            });
        } catch (err) {
            console.error("❌ Error scraping page:", err.message);
            if (browser) await browser.close();
            return res.status(500).json({
                status: "error",
                message: err.message,
            });
        }
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
        //const html = req.body?.html;
        console.log("Received body:", typeof req.body, req.body);

        // Accept both JSON or plain HTML
        const html = typeof req.body === "string" ? req.body : req.body?.html;
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
                protocolTimeout: 120000, // ✅ prevent Runtime.callFunctionOn timed out
                executablePath: '/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]

            });

            const page = await browser.newPage();
            const mmToPx = (mm, dpi = 900) => (mm / 25.4) * dpi;

            // :one: Load the HTMLL
            await page.setContent(html, { waitUntil: "load" });

            // ✅ Log failing image URLs (optional but VERY useful)
            page.on("requestfailed", req => {
                if (req.resourceType() === "image") {
                    console.log("❌ IMAGE FAILED:", req.url(), req.failure()?.errorText);
                }
            });

            // ✅ Wait for images to load, but max 5 sec per image
            await page.evaluate(async () => {
                const timeout = (ms) => new Promise(res => setTimeout(res, ms));

                const imgPromises = Array.from(document.images).map(img => {
                    if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
                    return Promise.race([
                        new Promise(res => (img.onload = img.onerror = res)),
                        timeout(5000) // max wait 5s per image
                    ]);
                });

                await Promise.all(imgPromises);
            });

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
                deviceScaleFactor: 3,
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
