import { QRSharpener } from "./QRSharpener.js";

const annotatedImage = document.getElementById("annotatedImage");
const resultImage = document.getElementById("resultImage");
const uploader = document.getElementById("uploader");
const convertBtn = document.getElementById("convertBtn");
const statusDiv = document.getElementById("status");
const dimensionsEdit = document.getElementById("dimensions");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const zoomLevel = document.getElementById("zoomLevel");
const editorSection = document.getElementById("editorSection");
const editorCanvas = document.getElementById("editorCanvas");
const previewCanvas = document.getElementById("previewCanvas");
const canvas = document.createElement("canvas");
const resultCanvas = document.createElement("canvas");

let currentBitmap = null;
let corners = [];
let draggedCorner = null;
let scaleX = 1;
let scaleY = 1;
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

uploader.addEventListener("change", fileUploaded, false);
convertBtn.addEventListener("click", convertImage, false);
dimensionsEdit.addEventListener("input", updateGrid, false);
zoomInBtn.addEventListener("click", () => zoomCanvas(1.2));
zoomOutBtn.addEventListener("click", () => zoomCanvas(0.8));
resetZoomBtn.addEventListener("click", resetZoom);
editorCanvas.addEventListener("wheel", handleWheel, { passive: false });

// Add mouse event listeners for dragging
editorCanvas.addEventListener("mousedown", startDrag);
editorCanvas.addEventListener("mousemove", drag);
editorCanvas.addEventListener("mouseup", () => { draggedCorner = null; isPanning = false; });
editorCanvas.addEventListener("mouseleave", () => { draggedCorner = null; isPanning = false; });

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
    
    // Set canvas to fixed display size
    editorCanvas.width = 600;
    editorCanvas.height = 400;
    
    // Calculate initial scale to fit image in canvas
    const scaleX = 600 / bitmap.width;
    const scaleY = 400 / bitmap.height;
    const initialScale = Math.min(scaleX, scaleY) * 0.9; // Leave some margin
    
    // Reset zoom and pan for new image
    zoom = initialScale;
    panX = (600 - bitmap.width * initialScale) / 2;
    panY = (400 - bitmap.height * initialScale) / 2;
    
    updateZoomDisplay();
    
    // Store bitmap for redrawing
    currentBitmap = bitmap;
    
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
    
    // Clear canvas
    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    
    // Save context for transformations
    ctx.save();
    
    // Apply pan and zoom
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    
    // Draw the image
    ctx.drawImage(currentBitmap, 0, 0);

    const dimensions = parseInt(dimensionsEdit.value);
    if (dimensions <= 0) {
        ctx.restore();
        updatePreview();
        return;
    }

    // Draw grid
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1 / zoom; // Adjust line width for zoom

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

    // Draw corner handles (adjust size for zoom)
    ctx.fillStyle = "red";
    const handleSize = Math.max(8, 15 / zoom); // Minimum 8 pixels in image space
    corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, handleSize, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.restore();
    updatePreview();
}

function startDrag(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Convert to image coordinates
    const imageX = (canvasX - panX) / zoom;
    const imageY = (canvasY - panY) / zoom;

    let foundCorner = false;
    corners.forEach((corner, index) => {
        const handleSize = Math.max(15, 20 / zoom); // Minimum 15 pixels, scales with zoom
        const distX = Math.abs(corner.x - imageX);
        const distY = Math.abs(corner.y - imageY);
        if (distX < handleSize && distY < handleSize) {
            draggedCorner = index;
            foundCorner = true;
        }
    });
    
    if (!foundCorner) {
        // Start panning
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
    }
}

function drag(e) {
    if (draggedCorner !== null) {
        const rect = editorCanvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Convert to image coordinates
        const imageX = (canvasX - panX) / zoom;
        const imageY = (canvasY - panY) / zoom;

        corners[draggedCorner].x = Math.max(0, Math.min(currentBitmap.width, imageX));
        corners[draggedCorner].y = Math.max(0, Math.min(currentBitmap.height, imageY));

        updateGrid();
    } else if (isPanning) {
        // Pan the view
        const deltaX = e.clientX - lastPanX;
        const deltaY = e.clientY - lastPanY;
        panX += deltaX;
        panY += deltaY;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        updateGrid();
    }
}

function zoomCanvas(factor) {
    const centerX = editorCanvas.width / 2;
    const centerY = editorCanvas.height / 2;
    
    zoom *= factor;
    zoom = Math.max(0.1, Math.min(5, zoom)); // Limit zoom between 0.1x and 5x
    
    updateZoomDisplay();
    updateGrid();
}

function resetZoom() {
    zoom = 1;
    panX = 0;
    panY = 0;
    updateZoomDisplay();
    updateGrid();
}

function handleWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomCanvas(factor);
}

function updateZoomDisplay() {
    zoomLevel.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
}

function updatePreview() {
    if (!currentBitmap) return;
    
    const dimensions = parseInt(dimensionsEdit.value);
    if (dimensions <= 0) return;
    
    // Create cropped image data based on corners
    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));
    
    const cropWidth = Math.max(1, maxX - minX);
    const cropHeight = Math.max(1, maxY - minY);
    
    // Create temporary canvas for cropping
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(currentBitmap, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    const imageData = tempCtx.getImageData(0, 0, cropWidth, cropHeight);
    
    // Generate QR using the same algorithm
    const sharpener = new QRSharpener(dimensions, 50);
    const result = sharpener.sharpen(imageData);
    
    // Display on preview canvas
    const previewCtx = previewCanvas.getContext("2d");
    const previewImageData = new ImageData(Uint8ClampedArray.from(result.qrCodeBuffer), dimensions, dimensions);
    previewCanvas.width = dimensions;
    previewCanvas.height = dimensions;
    previewCtx.putImageData(previewImageData, 0, 0);
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