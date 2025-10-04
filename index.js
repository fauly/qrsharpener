import { QRSharpener } from "./QRSharpener.js";

const annotatedImage = document.getElementById("annotatedImage");
const resultImage = document.getElementById("resultImage");
const uploader = document.getElementById("uploader");
const convertBtn = document.getElementById("convertBtn");
const statusDiv = document.getElementById("status");
const dimensionsEdit = document.getElementById("dimensions");
const editorSection = document.getElementById("editorSection");
const editorCanvas = document.getElementById("editorCanvas");
const canvas = document.createElement("canvas");
const resultCanvas = document.createElement("canvas");

let currentBitmap = null;
let corners = [];
let draggedCorner = null;

uploader.addEventListener("change", fileUploaded, false);
convertBtn.addEventListener("click", convertImage, false);
dimensionsEdit.addEventListener("input", updateGrid, false);
editorCanvas.addEventListener("mousedown", startDrag, false);
editorCanvas.addEventListener("mousemove", drag, false);
editorCanvas.addEventListener("mouseup", endDrag, false);
editorCanvas.addEventListener("mouseleave", endDrag, false);

class Spinner {
    constructor(target) {
        this.target = target;
    }
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
        statusDiv.textContent = "Image loaded. Adjust the corners and dimensions, then click 'Convert QR Code'.";
        showEditor(bitmap);
    }).catch((err) => {
        console.error(err);
        statusDiv.textContent = "Error loading image.";
    });
}

function showEditor(bitmap) {
    editorSection.style.display = "block";
    editorCanvas.width = bitmap.width;
    editorCanvas.height = bitmap.height;
    const ctx = editorCanvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);

    // Initialize corners to image corners
    corners = [
        {x: 0, y: 0},
        {x: bitmap.width, y: 0},
        {x: bitmap.width, y: bitmap.height},
        {x: 0, y: bitmap.height}
    ];

    updateGrid();
}

function updateGrid() {
    if (!currentBitmap) return;
    const ctx = editorCanvas.getContext("2d");
    ctx.drawImage(currentBitmap, 0, 0);

    const dimensions = parseInt(dimensionsEdit.value);
    if (dimensions <= 0) return;

    // Draw grid
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1;

    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));

    const width = maxX - minX;
    const height = maxY - minY;

    for (let i = 0; i <= dimensions; i++) {
        const x = minX + (width * i) / dimensions;
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();

        const y = minY + (height * i) / dimensions;
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
    }

    // Draw corner handles
    ctx.fillStyle = "red";
    corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function startDrag(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    corners.forEach((corner, index) => {
        if (Math.abs(corner.x - x) < 10 && Math.abs(corner.y - y) < 10) {
            draggedCorner = index;
        }
    });
}

function drag(e) {
    if (draggedCorner === null) return;

    const rect = editorCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    corners[draggedCorner].x = Math.max(0, Math.min(editorCanvas.width, x));
    corners[draggedCorner].y = Math.max(0, Math.min(editorCanvas.height, y));

    updateGrid();
}

function endDrag() {
    draggedCorner = null;
}

async function convertImage() {
    if (!currentBitmap) {
        statusDiv.textContent = "Please upload an image first.";
        return;
    }

    const spinner = new Spinner(statusDiv);
    spinner.start();
    try {
        // Create cropped bitmap based on corners
        const croppedBitmap = await cropToRectangle(currentBitmap, corners);
        processFile(croppedBitmap);
        statusDiv.textContent = "Processing complete.";
    } catch (err) {
        console.error(err);
        statusDiv.textContent = "Error processing image.";
    }
    spinner.stop();
}

async function cropToRectangle(bitmap, corners) {
    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));

    const width = maxX - minX;
    const height = maxY - minY;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, minX, minY, width, height, 0, 0, width, height);

    return createImageBitmap(canvas);
}

function processFile(bitmap) {

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

function renderResult(imageData, destination) {
    resultCanvas.width = imageData.width;
    resultCanvas.height = imageData.height;

    const context = resultCanvas.getContext('2d');
    context.putImageData(imageData, 0, 0);
    destination.src = resultCanvas.toDataURL();
}