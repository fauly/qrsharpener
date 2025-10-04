import { QRSharpener } from "./QRSharpener";

const annotatedImage = document.getElementById("annotatedImage") as HTMLImageElement;
const resultImage = document.getElementById("resultImage") as HTMLImageElement;
const uploader = document.getElementById("uploader") as HTMLInputElement;
const convertBtn = document.getElementById("convertBtn") as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;
const dimensionsEdit = document.getElementById("dimensions") as HTMLInputElement;
const canvas = document.createElement("canvas");
const resultCanvas = document.createElement("canvas");

let currentBitmap: ImageBitmap | null = null;

uploader.addEventListener("change", fileUploaded, false);
convertBtn.addEventListener("click", convertImage, false);

class Spinner {
    constructor(public readonly target: HTMLDivElement) {}
    start() {
        this.target.innerHTML = "Computing...";
    }

    stop() {
        this.target.innerText = "";
    }
}

function fileUploaded() {
    const files = uploader.files;
    if (files === null || files.length === 0)
        return;

    const file = files[0];
    createImageBitmap(file).then(bitmap => {
        currentBitmap = bitmap;
        convertBtn.disabled = false;
        statusDiv.textContent = "Image loaded. Click 'Convert QR Code' to process.";
    }).catch((err: any) => {
        console.error(err);
        statusDiv.textContent = "Error loading image.";
    });
}

function convertImage() {
    if (!currentBitmap) {
        statusDiv.textContent = "Please upload an image first.";
        return;
    }

    const spinner = new Spinner(statusDiv);
    spinner.start();
    try {
        processFile(currentBitmap);
        statusDiv.textContent = "Processing complete.";
    } catch (err: any) {
        console.error(err);
        statusDiv.textContent = "Error processing image.";
    }
    spinner.stop();
}

function processFile(bitmap: ImageBitmap) {

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    if (context === null)
        throw new Error("Cannot get 2d canvas context");

    const dimensions = parseInt(dimensionsEdit.value);

    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height);

    const sharpener = new QRSharpener(dimensions, 50);
    const result = sharpener.sharpen(data);

    const resultImageData = new ImageData(Uint8ClampedArray.from(result.qrCodeBuffer), dimensions, dimensions);
    const annotatedImageData = new ImageData(Uint8ClampedArray.from(result.annotatedImageBuffer), bitmap.width, bitmap.height);

    renderResult(annotatedImageData, annotatedImage);
    renderResult(resultImageData, resultImage);
}

function renderResult(imageData: ImageData, destination: HTMLImageElement) {
    resultCanvas.width = imageData.width;
    resultCanvas.height = imageData.height;

    const context = resultCanvas.getContext('2d')!;
    context.putImageData(imageData, 0, 0);
    destination.src = resultCanvas.toDataURL();
}