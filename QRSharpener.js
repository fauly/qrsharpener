export class QRSharpener {

    constructor(dimension, colorThreshold) {
        this.dimension = dimension;
        this.colorThreshold = colorThreshold;
    }

    sharpen(imageData, corners = null) {
        if (corners) {
            return this.sharpenWithPerspective(imageData, corners);
        }

        const qrCodeBuffer = new Array();
        const annotatedImageBuffer = Array.from(imageData.data);

        const blockSizeX = imageData.width / this.dimension;
        const blockSizeY = imageData.height / this.dimension;

        for (let y = 0; y < this.dimension; ++y) {
            for (let x = 0; x < this.dimension; ++x) {

                const px = x * Math.round(blockSizeX);
                const py = y * Math.round(blockSizeY);

                const nx = px + Math.round(blockSizeX / 2);
                const ny = py + Math.round(blockSizeY / 2);

                let pixelIndex = ((ny * imageData.width) + nx) * 4;
                pixelIndex = QRSharpener.closestDividableBy(pixelIndex, 4);

                const pixels = Array.from(imageData.data.slice(pixelIndex, pixelIndex + 4));

                // choose whether a pixel is black or white
                if (pixels[0] > this.colorThreshold || pixels[1] > this.colorThreshold || pixels[2] > this.colorThreshold)
                    qrCodeBuffer.push(255, 255, 255, 255);
                else
                    qrCodeBuffer.push(0, 0, 0, 255);

                // draw a red dot onto where we consumed the pixel from
                annotatedImageBuffer[pixelIndex] = 255;
                annotatedImageBuffer[pixelIndex + 1] = 0;
                annotatedImageBuffer[pixelIndex + 2] = 0;
                annotatedImageBuffer[pixelIndex + 3] = 255;
            }
        }

        return {
            qrCodeBuffer,
            annotatedImageBuffer
        }
    }

    sharpenWithPerspective(imageData, corners) {
        const qrCodeBuffer = new Array();
        const annotatedImageBuffer = Array.from(imageData.data);

        // corners should be [topLeft, topRight, bottomRight, bottomLeft]
        const topLeft = corners[0];
        const topRight = corners[1];
        const bottomRight = corners[2];
        const bottomLeft = corners[3];

        for (let y = 0; y < this.dimension; ++y) {
            for (let x = 0; x < this.dimension; ++x) {

                // Map grid position to quadrilateral position using bilinear interpolation
                // Sample at the center of each grid cell
                const t_x = (x + 0.5) / this.dimension;
                const t_y = (y + 0.5) / this.dimension;

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
                pixelIndex = QRSharpener.closestDividableBy(pixelIndex, 4);

                const pixels = Array.from(imageData.data.slice(pixelIndex, pixelIndex + 4));

                // choose whether a pixel is black or white
                if (pixels[0] > this.colorThreshold || pixels[1] > this.colorThreshold || pixels[2] > this.colorThreshold)
                    qrCodeBuffer.push(255, 255, 255, 255);
                else
                    qrCodeBuffer.push(0, 0, 0, 255);

                // draw a red dot onto where we consumed the pixel from
                annotatedImageBuffer[pixelIndex] = 255;
                annotatedImageBuffer[pixelIndex + 1] = 0;
                annotatedImageBuffer[pixelIndex + 2] = 0;
                annotatedImageBuffer[pixelIndex + 3] = 255;
            }
        }

        return {
            qrCodeBuffer,
            annotatedImageBuffer
        }
    }

    // returns the number closest to n that is dividable by m
    static closestDividableBy(n, m) {
        const quotient = n / m;
        const number1 = m * quotient;
        const number2 = (n * m) > 0 ? (m * (quotient + 1)) : (m * (quotient - 1));

        if (Math.abs(n - number1) < Math.abs(n - number2))
            return number1;
        return number2;
    }

}