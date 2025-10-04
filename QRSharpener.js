export class QRSharpener {

    constructor(dimension, colorThreshold) {
        this.dimension = dimension;
        this.colorThreshold = colorThreshold;
    }

    sharpen(imageData) {
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