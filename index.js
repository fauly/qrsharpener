import jsQR from "jsqr";
import { QRSharpener } from "./QRSharpener.js";

const resultImage = document.getElementById("resultImage");
const croppedImage = document.getElementById("croppedImage");
const threshold = document.getElementById("threshold");
const thresholdValue = document.getElementById("thresholdValue");
const brightness = document.getElementById("brightness");
const brightnessValue = document.getElementById("brightnessValue");
const contrast = document.getElementById("contrast");
const contrastValue = document.getElementById("contrastValue");
const saturation = document.getElementById("saturation");
const saturationValue = document.getElementById("saturationValue");
const sharpness = document.getElementById("sharpness");
const sharpnessValue = document.getElementById("sharpnessValue");
const resetFilters = document.getElementById("resetFilters");
const uploader = document.getElementById("uploader");
const convertBtn = document.getElementById("convertBtn");
const statusDiv = document.getElementById("status");
const dimensionsEdit = document.getElementById("dimensions");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetCorrection = document.getElementById("resetCorrection");
const correctionSection = document.getElementById("correctionSection");
const correctionCanvas = document.getElementById("correctionCanvas");
const overlayOpacity = document.getElementById("overlayOpacity");
const opacityValue = document.getElementById("opacityValue");
const toggleCorrection = document.getElementById("toggleCorrection");
const exportCorrected = document.getElementById("exportCorrected");
const decodedOutput = document.getElementById("decodedOutput");
const decodedStatus = document.getElementById("decodedStatus");
const essentialHints = document.getElementById("essentialHints");
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
let hoveredCorner = null; // Track which corner is being hovered

// Correction mode variables
let correctionMode = false;
let originalQRBuffer = null;
let correctedQRBuffer = null;
let correctionBaseImageData = null;

// Debounce function for input fields
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateThresholdDisplay() {
    thresholdValue.textContent = threshold.value;
}

function updateFilterDisplay() {
    brightnessValue.textContent = brightness.value;
    contrastValue.textContent = contrast.value;
    saturationValue.textContent = saturation.value;
    sharpnessValue.textContent = sharpness.value;
}

function applyFilters() {
    const brightnessVal = brightness.value / 100;
    const contrastVal = contrast.value / 100;
    const saturationVal = saturation.value / 100;
    const sharpnessVal = sharpness.value / 100;
    
    // Apply CSS filters to the editor canvas
    let filterString = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturationVal})`;
    
    // Add sharpness effect using a combination of contrast and brightness
    if (sharpnessVal > 0) {
        // Simple sharpness approximation using contrast boost
        const sharpnessContrast = 1 + (sharpnessVal * 0.5);
        filterString += ` contrast(${sharpnessContrast})`;
    }
    
    editorCanvas.style.filter = filterString;
    
    // Update the grid and preview with filtered image
    updateGrid();
    updatePreview();
}

function getFilteredImageData() {
    if (!currentBitmap) return null;
    
    // Create a temporary canvas with the same filters applied
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = currentBitmap.width;
    tempCanvas.height = currentBitmap.height;
    const tempCtx = tempCanvas.getContext("2d");
    
    // Apply the same filters to the temp canvas
    const brightnessVal = brightness.value / 100;
    const contrastVal = contrast.value / 100;
    const saturationVal = saturation.value / 100;
    const sharpnessVal = sharpness.value / 100;
    
    let filterString = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturationVal})`;
    if (sharpnessVal > 0) {
        const sharpnessContrast = 1 + (sharpnessVal * 0.5);
        filterString += ` contrast(${sharpnessContrast})`;
    }
    
    tempCtx.filter = filterString;
    tempCtx.drawImage(currentBitmap, 0, 0);
    
    return tempCtx.getImageData(0, 0, currentBitmap.width, currentBitmap.height);
}

function resetAllFilters() {
    brightness.value = 100;
    contrast.value = 100;
    saturation.value = 100;
    sharpness.value = 0;
    
    updateFilterDisplay();
    applyFilters();
}

// Initialize displays
updateThresholdDisplay();
updateFilterDisplay();

uploader.addEventListener("change", fileUploaded, false);
convertBtn.addEventListener("click", convertImage, false);
dimensionsEdit.addEventListener("input", debounce(updateGrid, 150), false);
threshold.addEventListener("input", updateThresholdDisplay, false);
threshold.addEventListener("input", debounce(updateGrid, 150), false);
brightness.addEventListener("input", updateFilterDisplay, false);
brightness.addEventListener("input", applyFilters, false);
contrast.addEventListener("input", updateFilterDisplay, false);
contrast.addEventListener("input", applyFilters, false);
saturation.addEventListener("input", updateFilterDisplay, false);
saturation.addEventListener("input", applyFilters, false);
sharpness.addEventListener("input", updateFilterDisplay, false);
sharpness.addEventListener("input", applyFilters, false);
resetFilters.addEventListener("click", resetAllFilters, false);
zoomInBtn.addEventListener("click", () => zoomCanvas(1.2));
zoomOutBtn.addEventListener("click", () => zoomCanvas(0.8));
resetZoomBtn.addEventListener("click", resetZoom);
editorCanvas.addEventListener("wheel", handleWheel, { passive: false });

// Correction interface event listeners
overlayOpacity.addEventListener("input", () => {
    opacityValue.textContent = overlayOpacity.value + "%";
    updateCorrectionCanvas();
});
toggleCorrection.addEventListener("click", () => {
    correctionMode = !correctionMode;
    toggleCorrection.textContent = correctionMode ? "Exit Correction Mode" : "Toggle Correction Mode";
    updateCorrectionCanvas();
});
correctionCanvas.addEventListener("click", handleCorrectionClick);
exportCorrected.addEventListener("click", exportCorrectedQR);
resetCorrection.addEventListener("click", () => {
    correctedQRBuffer.set(originalQRBuffer);
    updateCorrectionCanvas();
    updateResultImage();
});

// Add mouse event listeners for dragging
editorCanvas.addEventListener("mousedown", startDrag);
editorCanvas.addEventListener("mousemove", (e) => {
    checkHover(e);
    drag(e);
});
editorCanvas.addEventListener("mouseup", (e) => { 
    draggedCorner = null; 
    isPanning = false; 
    // Reset cursor
    editorCanvas.style.cursor = 'grab';
});
editorCanvas.addEventListener("mouseleave", () => { 
    draggedCorner = null; 
    isPanning = false; 
    hoveredCorner = null; 
    editorCanvas.style.cursor = 'default';
    updateGrid(); 
});
// Prevent context menu on right-click for better UX
editorCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

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
    // Validate dimensions (QR codes support up to 177x177, but we'll be conservative)
    const validDimensions = Math.max(1, Math.min(177, dimensions));
    if (dimensions !== validDimensions) {
        dimensionsEdit.value = validDimensions;
    }
    
    if (validDimensions <= 0) {
        ctx.restore();
        updatePreview();
        return;
    }

    // Draw grid with perspective correction
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1 / zoom;

    // Use corners in logical order: [top-left, top-right, bottom-right, bottom-left]
    // This assumes the user maintains reasonable corner positioning
    const topLeft = corners[0];
    const topRight = corners[1];
    const bottomRight = corners[2];
    const bottomLeft = corners[3];

    for (let i = 0; i <= validDimensions; i++) {
        const t = i / validDimensions;

        // Draw vertical grid lines (interpolated between left and right edges)
        // Left edge: interpolate between top-left and bottom-left
        const leftX = topLeft.x + t * (bottomLeft.x - topLeft.x);
        const leftY = topLeft.y + t * (bottomLeft.y - topLeft.y);

        // Right edge: interpolate between top-right and bottom-right
        const rightX = topRight.x + t * (bottomRight.x - topRight.x);
        const rightY = topRight.y + t * (bottomRight.y - topRight.y);

        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.stroke();

        // Draw horizontal grid lines (interpolated between top and bottom edges)
        // Top edge: interpolate between top-left and top-right
        const topX = topLeft.x + t * (topRight.x - topLeft.x);
        const topY = topLeft.y + t * (topRight.y - topLeft.y);

        // Bottom edge: interpolate between bottom-left and bottom-right
        const bottomX = bottomLeft.x + t * (bottomRight.x - bottomLeft.x);
        const bottomY = bottomLeft.y + t * (bottomRight.y - bottomLeft.y);

        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(bottomX, bottomY);
        ctx.stroke();
    }

    // Draw corner handles (adjust size for zoom)
    ctx.fillStyle = "red";
    const handleSize = Math.max(4, 8 / zoom); // Smaller handles: minimum 4 pixels in image space
    corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, handleSize, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.restore();
    
    // Draw magnified view if hovering over a corner
    if (hoveredCorner !== null) {
        drawMagnifier(ctx, corners[hoveredCorner]);
    }
    
    updatePreview();
}

function checkHover(e) {
    if (!currentBitmap) return;
    
    const rect = editorCanvas.getBoundingClientRect();
    // Scale mouse coordinates to match internal canvas coordinate system
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert to image coordinates
    const imageX = (canvasX - panX) / zoom;
    const imageY = (canvasY - panY) / zoom;

    let foundHover = false;
    corners.forEach((corner, index) => {
        const handleSize = Math.max(6, 12 / zoom);
        const distX = Math.abs(corner.x - imageX);
        const distY = Math.abs(corner.y - imageY);
        if (distX < handleSize && distY < handleSize) {
            hoveredCorner = index;
            foundHover = true;
        }
    });
    
    if (!foundHover) {
        hoveredCorner = null;
    }
    
    // Update cursor based on what's being hovered
    if (foundHover) {
        editorCanvas.style.cursor = 'pointer';
    } else {
        editorCanvas.style.cursor = isPanning ? 'grabbing' : 'grab';
    }
    
    updateGrid();
}

function drawMagnifier(ctx, corner) {
    const magnifierSize = 60; // Size of the magnifier window
    const zoomFactor = 8; // How much to zoom in
    const pixelRadius = 3; // How many pixels around the center to show
    
    // Position the magnifier near the corner but not overlapping
    const magnifierX = corner.x > currentBitmap.width / 2 ? corner.x - magnifierSize - 20 : corner.x + 20;
    const magnifierY = corner.y > currentBitmap.height / 2 ? corner.y - magnifierSize - 20 : corner.y + 20;
    
    // Ensure magnifier stays within canvas bounds
    const clampedMagnifierX = Math.max(10, Math.min(editorCanvas.width - magnifierSize - 10, magnifierX));
    const clampedMagnifierY = Math.max(10, Math.min(editorCanvas.height - magnifierSize - 30, magnifierY));
    
    // Draw magnifier background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(clampedMagnifierX - 2, clampedMagnifierY - 2, magnifierSize + 4, magnifierSize + 4);
    ctx.fillStyle = "white";
    ctx.fillRect(clampedMagnifierX, clampedMagnifierY, magnifierSize, magnifierSize);
    
    // Calculate safe bounds for pixel sampling
    const centerX = Math.floor(corner.x);
    const centerY = Math.floor(corner.y);
    const startX = Math.max(0, centerX - pixelRadius);
    const startY = Math.max(0, centerY - pixelRadius);
    const endX = Math.min(currentBitmap.width, centerX + pixelRadius + 1);
    const endY = Math.min(currentBitmap.height, centerY + pixelRadius + 1);
    
    const actualWidth = endX - startX;
    const actualHeight = endY - startY;
    
    if (actualWidth <= 0 || actualHeight <= 0) return;
    
    const pixelSize = magnifierSize / ((pixelRadius * 2) + 1);
    
    // Get image data for the magnified area
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = currentBitmap.width;
    tempCanvas.height = currentBitmap.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(currentBitmap, 0, 0);
    const imageData = tempCtx.getImageData(startX, startY, actualWidth, actualHeight);
    
    // Draw magnified pixels
    for (let y = 0; y < actualHeight; y++) {
        for (let x = 0; x < actualWidth; x++) {
            const pixelIndex = (y * actualWidth + x) * 4;
            const r = imageData.data[pixelIndex];
            const g = imageData.data[pixelIndex + 1];
            const b = imageData.data[pixelIndex + 2];
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            const drawX = clampedMagnifierX + (x - (centerX - startX)) * pixelSize + (magnifierSize / 2) - (pixelSize / 2);
            const drawY = clampedMagnifierY + (y - (centerY - startY)) * pixelSize + (magnifierSize / 2) - (pixelSize / 2);
            ctx.fillRect(drawX, drawY, pixelSize, pixelSize);
        }
    }
    
    // Draw crosshair at center
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1;
    const centerDrawX = clampedMagnifierX + magnifierSize / 2;
    const centerDrawY = clampedMagnifierY + magnifierSize / 2;
    ctx.beginPath();
    ctx.moveTo(centerDrawX - 5, centerDrawY);
    ctx.lineTo(centerDrawX + 5, centerDrawY);
    ctx.moveTo(centerDrawX, centerDrawY - 5);
    ctx.lineTo(centerDrawX, centerDrawY + 5);
    ctx.stroke();
    
    // Get RGB values of the center pixel (clamp to image bounds)
    const clampedCenterX = Math.max(0, Math.min(currentBitmap.width - 1, centerX));
    const clampedCenterY = Math.max(0, Math.min(currentBitmap.height - 1, centerY));
    const centerImageData = tempCtx.getImageData(clampedCenterX, clampedCenterY, 1, 1);
    const r = centerImageData.data[0];
    const g = centerImageData.data[1];
    const b = centerImageData.data[2];
    
    // Draw RGB values
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(`R:${r} G:${g} B:${b}`, clampedMagnifierX, clampedMagnifierY + magnifierSize + 15);
}

function startDrag(e) {
    const rect = editorCanvas.getBoundingClientRect();
    // Scale mouse coordinates to match internal canvas coordinate system
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert to image coordinates (inverse of ctx.translate(panX, panY); ctx.scale(zoom, zoom))
    const imageX = (canvasX - panX) / zoom;
    const imageY = (canvasY - panY) / zoom;

    // Check for corner handles first
    let foundCorner = false;
    corners.forEach((corner, index) => {
        const handleSize = Math.max(6, 12 / zoom); // Smaller handles: minimum 6 pixels, scales with zoom
        const distX = Math.abs(corner.x - imageX);
        const distY = Math.abs(corner.y - imageY);
        if (distX < handleSize && distY < handleSize) {
            draggedCorner = index;
            foundCorner = true;
        }
    });
    
    // If no corner found, or if middle mouse button is pressed, start panning
    if (!foundCorner || e.button === 1) { // Middle mouse button
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        editorCanvas.style.cursor = 'grabbing';
        // Prevent default middle-click behavior
        e.preventDefault();
    }
}

function drag(e) {
    if (!currentBitmap) return;

    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;

    if (draggedCorner !== null) {
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        
        // Convert to image coordinates (inverse of ctx.translate(panX, panY); ctx.scale(zoom, zoom))
        const imageX = (canvasX - panX) / zoom;
        const imageY = (canvasY - panY) / zoom;

        corners[draggedCorner].x = imageX;
        corners[draggedCorner].y = imageY;

        updateGrid();
    } else if (isPanning) {
        // Pan the view
        const deltaX = e.clientX - lastPanX;
        const deltaY = e.clientY - lastPanY;
        panX += deltaX * scaleX;
        panY += deltaY * scaleY;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        updateGrid();
    }
}

function zoomCanvas(factor) {
    const centerX = editorCanvas.width / 2;
    const centerY = editorCanvas.height / 2;
    
    zoom *= factor;
    zoom = Math.max(0.1, Math.min(10, zoom)); // Limit zoom between 0.1x and 10x
    
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
    // Validate dimensions (QR codes support up to 177x177, but we'll be conservative)
    const validDimensions = Math.max(1, Math.min(177, dimensions));
    
    if (validDimensions <= 0) return;
    
    // Get filtered image data for preview
    let imageData = getFilteredImageData();
    if (!imageData) {
        // Fallback to original bitmap if filtering fails
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = currentBitmap.width;
        tempCanvas.height = currentBitmap.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(currentBitmap, 0, 0);
        imageData = tempCtx.getImageData(0, 0, currentBitmap.width, currentBitmap.height);
    }
    
    // Generate QR using perspective-correct sampling
    const sharpener = new QRSharpener(validDimensions, parseInt(threshold.value));
    const result = sharpener.sharpen(imageData, corners);
    
    // Display on preview canvas
    const previewCtx = previewCanvas.getContext("2d");
    const previewImageData = new ImageData(Uint8ClampedArray.from(result.qrCodeBuffer), validDimensions, validDimensions);
    previewCanvas.width = validDimensions;
    previewCanvas.height = validDimensions;
    previewCtx.putImageData(previewImageData, 0, 0);

    updateDecodedOutput(result.qrCodeBuffer, validDimensions, "Preview", previewImageData);
}

async function convertImage() {
    if (!currentBitmap) {
        statusDiv.textContent = "Please upload an image first.";
        return;
    }

    const dimensions = parseInt(dimensionsEdit.value);
    // Validate dimensions (QR codes support up to 177x177, but we'll be conservative)
    const validDimensions = Math.max(1, Math.min(177, dimensions));
    
    if (validDimensions <= 0) {
        statusDiv.textContent = "Please enter a valid dimension (1-177).";
        return;
    }

    const spinner = new Spinner(statusDiv);
    spinner.start();
    try {
        // Process using perspective correction from the original bitmap
        processFile(currentBitmap, validDimensions, corners);
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

function processFile(bitmap, dimensions, corners) {
    // Get filtered image data for processing
    const filteredData = getFilteredImageData();
    const imageData = filteredData || (() => {
        // Fallback to original bitmap if filtering fails
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
    })();

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = canvas.getContext("2d");
    if (context === null)
        throw new Error("Cannot get 2d canvas context");
    context.putImageData(imageData, 0, 0);

    const sharpener = new QRSharpener(dimensions, parseInt(threshold.value));
    const result = sharpener.sharpen(imageData, corners);

    // Create perspective-corrected cropped image
    const correctedCropCanvas = document.createElement("canvas");
    correctedCropCanvas.width = dimensions;
    correctedCropCanvas.height = dimensions;
    const correctedCropCtx = correctedCropCanvas.getContext("2d");
    
    // Create corrected image data by sampling with perspective correction
    const correctedImageData = correctedCropCtx.createImageData(dimensions, dimensions);
    
    // corners should be [topLeft, topRight, bottomRight, bottomLeft]
    const topLeft = corners[0];
    const topRight = corners[1];
    const bottomRight = corners[2];
    const bottomLeft = corners[3];

    for (let y = 0; y < dimensions; ++y) {
        for (let x = 0; x < dimensions; ++x) {
            // Map grid position to quadrilateral position using bilinear interpolation
            const t_x = x / (dimensions - 1); // Use full range for corners
            const t_y = y / (dimensions - 1);

            // Interpolate along top and bottom edges
            const topX = topLeft.x + t_x * (topRight.x - topLeft.x);
            const topY = topLeft.y + t_x * (topRight.y - topLeft.y);
            const bottomX = bottomLeft.x + t_x * (bottomRight.x - bottomLeft.x);
            const bottomY = bottomLeft.y + t_x * (bottomRight.y - bottomLeft.y);

            // Interpolate between top and bottom
            const sampleX = topX + t_y * (bottomX - topX);
            const sampleY = topY + t_y * (bottomY - topY);

            // Sample the pixel at this position
            const nx = Math.round(sampleX);
            const ny = Math.round(sampleY);

            // Clamp to image bounds
            const clampedNx = Math.max(0, Math.min(imageData.width - 1, nx));
            const clampedNy = Math.max(0, Math.min(imageData.height - 1, ny));

            let pixelIndex = ((clampedNy * imageData.width) + clampedNx) * 4;
            const pixels = Array.from(imageData.data.slice(pixelIndex, pixelIndex + 4));

            // Copy the actual pixel colors (not binary)
            const targetIndex = (y * dimensions + x) * 4;
            correctedImageData.data[targetIndex] = pixels[0];     // R
            correctedImageData.data[targetIndex + 1] = pixels[1]; // G
            correctedImageData.data[targetIndex + 2] = pixels[2]; // B
            correctedImageData.data[targetIndex + 3] = pixels[3]; // A
        }
    }
    
    correctedCropCtx.putImageData(correctedImageData, 0, 0);
    croppedImage.src = correctedCropCanvas.toDataURL();
    correctionBaseImageData = new ImageData(new Uint8ClampedArray(correctedImageData.data), correctedImageData.width, correctedImageData.height);

    updateDecodedOutput(result.qrCodeBuffer, dimensions, "Conversion", correctedImageData);
}

function renderResult(imageData, destination) {
    resultCanvas.width = imageData.width;
    resultCanvas.height = imageData.height;

    const context = resultCanvas.getContext('2d');
    context.putImageData(imageData, 0, 0);
    destination.src = resultCanvas.toDataURL();

    if (destination === resultImage) {
        updateDecodedOutput(imageData.data, imageData.width, "Corrected Output", imageData);
    }
}

function showCorrectionInterface(dimensions, annotatedData, qrData) {
    correctionSection.style.display = 'block';
    
    // Set up correction canvas - use the corrected dimensions
    correctionCanvas.width = dimensions;
    correctionCanvas.height = dimensions;
    
    // Store dimensions for coordinate conversion
    correctionCanvas.dataset.dimensions = dimensions;
    
    updateCorrectionCanvas();
}

function updateCorrectionCanvas() {
    if (!correctionCanvas.dataset.dimensions) return;
    if (!correctedQRBuffer) {
        if (essentialHints) {
            essentialHints.textContent = "Awaiting a processed QR before showing guidance.";
        }
        return;
    }
    
    const ctx = correctionCanvas.getContext('2d');
    const dimensions = parseInt(correctionCanvas.dataset.dimensions);
    
    // Clear canvas
    ctx.clearRect(0, 0, correctionCanvas.width, correctionCanvas.height);
    
    // Draw corrected cropped image as background
    if (!correctionBaseImageData) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, correctionCanvas.width, correctionCanvas.height);
    } else {
        const correctedCanvas = document.createElement('canvas');
        correctedCanvas.width = correctionBaseImageData.width;
        correctedCanvas.height = correctionBaseImageData.height;
        const correctedCtx = correctedCanvas.getContext('2d');
        correctedCtx.putImageData(correctionBaseImageData, 0, 0);
        ctx.drawImage(correctedCanvas, 0, 0, correctionBaseImageData.width, correctionBaseImageData.height, 0, 0, correctionCanvas.width, correctionCanvas.height);
    }
    
    // Draw QR overlay with opacity
    const opacity = parseInt(overlayOpacity.value) / 100;
    ctx.globalAlpha = opacity;
    
    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = dimensions;
    qrCanvas.height = dimensions;
    const qrCtx = qrCanvas.getContext('2d');
    const qrImageData = new ImageData(new Uint8ClampedArray(correctedQRBuffer), dimensions, dimensions);
    qrCtx.putImageData(qrImageData, 0, 0);
    
    ctx.drawImage(qrCanvas, 0, 0, dimensions, dimensions, 0, 0, correctionCanvas.width, correctionCanvas.height);
    
    ctx.globalAlpha = 1.0;
    
    // Draw grid lines if in correction mode
    if (correctionMode) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 1;
        
        const cellSize = correctionCanvas.width / dimensions;
        
        for (let i = 0; i <= dimensions; i++) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, correctionCanvas.height);
            ctx.stroke();
            
            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(correctionCanvas.width, i * cellSize);
            ctx.stroke();
        }
    }

    const essentialReport = highlightEssentialModules(ctx, dimensions);
    if (essentialHints) {
        essentialHints.innerHTML = essentialReport.message;
    }
}

function highlightEssentialModules(ctx, dimensions) {
    if (!correctedQRBuffer) {
        return {
            message: "Load or generate a QR to see essential guidance.",
            issues: []
        };
    }

    const issues = [];
    const cellSize = correctionCanvas.width / dimensions;

    const finderPattern = [
        [1,1,1,1,1,1,1],
        [1,0,0,0,0,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,0,0,0,0,1],
        [1,1,1,1,1,1,1]
    ];

    const finderLocations = [
        { name: "Top-left finder", x: 0, y: 0 },
        { name: "Top-right finder", x: dimensions - 7, y: 0 },
        { name: "Bottom-left finder", x: 0, y: dimensions - 7 }
    ];

    const overlayRects = [];

    finderLocations.forEach(loc => {
        for (let dy = 0; dy < 7; dy++) {
            for (let dx = 0; dx < 7; dx++) {
                const expected = finderPattern[dy][dx] === 1;
                const moduleX = loc.x + dx;
                const moduleY = loc.y + dy;
                if (moduleX < 0 || moduleY < 0 || moduleX >= dimensions || moduleY >= dimensions) continue;
                const actualIsBlack = isModuleBlack(correctedQRBuffer, dimensions, moduleX, moduleY);
                if (actualIsBlack !== expected) {
                    const issueType = expected ? "needs to be black" : "needs to be white";
                    issues.push({
                        area: loc.name,
                        x: moduleX,
                        y: moduleY,
                        expectation: expected,
                        message: `${loc.name}: module (${moduleX},${moduleY}) ${issueType}.`
                    });
                    overlayRects.push({
                        x: moduleX,
                        y: moduleY,
                        expectation: expected
                    });
                }
            }
        }
    });

    // Timing patterns along row 6 and column 6 (0-indexed)
    const timingIndex = 6;
    const timingStart = 8;
    const timingEnd = dimensions - 8;

    for (let x = timingStart; x < timingEnd; x++) {
        const expectedBlack = ((x + timingIndex) % 2 === 0);
        const actualBlack = isModuleBlack(correctedQRBuffer, dimensions, x, timingIndex);
        if (actualBlack !== expectedBlack) {
            issues.push({
                area: "Horizontal timing",
                x,
                y: timingIndex,
                expectation: expectedBlack,
                message: `Timing row: module (${x},${timingIndex}) should be ${expectedBlack ? "black" : "white"}.`
            });
            overlayRects.push({ x, y: timingIndex, expectation: expectedBlack });
        }
    }

    for (let y = timingStart; y < timingEnd; y++) {
        const expectedBlack = ((timingIndex + y) % 2 === 0);
        const actualBlack = isModuleBlack(correctedQRBuffer, dimensions, timingIndex, y);
        if (actualBlack !== expectedBlack) {
            issues.push({
                area: "Vertical timing",
                x: timingIndex,
                y,
                expectation: expectedBlack,
                message: `Timing column: module (${timingIndex},${y}) should be ${expectedBlack ? "black" : "white"}.`
            });
            overlayRects.push({ x: timingIndex, y, expectation: expectedBlack });
        }
    }

    // Draw overlay highlights
    ctx.save();
    overlayRects.forEach(rect => {
        ctx.fillStyle = rect.expectation ? "rgba(220,38,38,0.45)" : "rgba(59,130,246,0.35)";
        ctx.fillRect(rect.x * cellSize, rect.y * cellSize, cellSize, cellSize);
        ctx.strokeStyle = rect.expectation ? "rgba(185,28,28,0.8)" : "rgba(37,99,235,0.8)";
        ctx.strokeRect(rect.x * cellSize + 0.5, rect.y * cellSize + 0.5, cellSize - 1, cellSize - 1);
    });
    ctx.restore();

    let message;
    if (issues.length === 0) {
        message = "✅ Finder and timing patterns look solid. Focus on the data modules next.";
    } else {
        const grouped = issues.slice(0, 6).map(item => `• ${item.message}`).join("<br>");
        const extra = issues.length > 6 ? `<br>…and ${issues.length - 6} more modules need attention.` : "";
        message = `<strong>Critical fixes suggested:</strong><br>${grouped}${extra}`;
    }

    return { message, issues };
}

function isModuleBlack(buffer, dimensions, x, y) {
    const index = (y * dimensions + x) * 4;
    return buffer[index] < 128;
}

function updateResultImage() {
    if (!correctedQRBuffer || !correctionCanvas.dataset.dimensions) return;
    const dimensions = parseInt(correctionCanvas.dataset.dimensions);
    const correctedImageData = new ImageData(new Uint8ClampedArray(correctedQRBuffer), dimensions, dimensions);
    renderResult(correctedImageData, resultImage);
}