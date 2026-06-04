import React, { useEffect, useRef } from 'react';
import * as ort from 'onnxruntime-web';

// ============================================
// Class colors from CVAT (သင် ပေးထားတဲ့အတိုင်း)
// ============================================
const classColors = {
  'Кафе': '#fa3253',     // red-pink
  'Ресторан': '#24b353',  // green
  'Столовая': '#ddff33'   // yellow-green
};

// Class names in order (YOLO model output order)
const classNames = ['Кафе', 'Ресторан', 'Столовая'];

const SegmentationCanvas = ({ image, modelPath, onResult }) => {
  const canvasRef = useRef(null);
  const modelSession = useRef(null);

  // ============================================
  // Load ONNX model on component mount
  // ============================================
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Create ONNX session
        modelSession.current = await ort.InferenceSession.create(modelPath);
        console.log('✅ ONNX model loaded');
      } catch (error) {
        console.error('❌ Failed to load ONNX model:', error);
      }
    };
    loadModel();
  }, [modelPath]);

  // ============================================
  // Run segmentation when image changes
  // ============================================
  useEffect(() => {
    if (!image || !modelSession.current) return;

    const runSegmentation = async () => {
      try {
        // Load image
        const imgElement = new Image();
        imgElement.src = URL.createObjectURL(image);
        await imgElement.decode();

        // Get canvas context
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Resize canvas to 640x640 (YOLO input size)
        canvas.width = 640;
        canvas.height = 640;
        ctx.drawImage(imgElement, 0, 0, 640, 640);

        // Get image data and preprocess
        const imageData = ctx.getImageData(0, 0, 640, 640);
        const inputTensor = preprocessImage(imageData);

        // Run inference
        const feeds = { input: inputTensor };
        const results = await modelSession.current.run(feeds);

        // Post-process results
        const detections = postprocess(results);

        // Send results to parent component
        if (onResult) onResult(detections);

        // Draw segmentation masks on canvas
        drawMasks(ctx, detections);

        // Clean up object URL
        URL.revokeObjectURL(imgElement.src);
      } catch (error) {
        console.error('Segmentation error:', error);
      }
    };

    runSegmentation();
  }, [image]);

  // ============================================
  // Preprocess image for ONNX model
  // ============================================
  const preprocessImage = (imageData) => {
    const { data, width, height } = imageData;

    // Create float32 array for input (1, 3, 640, 640)
    const input = new Float32Array(1 * 3 * 640 * 640);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Normalize to [0, 1] and rearrange channels (RGB)
        const r = data[idx] / 255.0;
        const g = data[idx + 1] / 255.0;
        const b = data[idx + 2] / 255.0;

        // Normalize with ImageNet stats
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        const normR = (r - mean[0]) / std[0];
        const normG = (g - mean[1]) / std[1];
        const normB = (b - mean[2]) / std[2];

        // Fill tensor (batch=0, channel, y, x)
        input[0 * 640 * 640 + y * 640 + x] = normR;
        input[1 * 640 * 640 + y * 640 + x] = normG;
        input[2 * 640 * 640 + y * 640 + x] = normB;
      }
    }

    return new ort.Tensor('float32', input, [1, 3, 640, 640]);
  };

  // ============================================
// Postprocess model output (YOLOv8 format)
// ============================================
const postprocess = (outputs) => {
  const detections = [];

  // YOLOv8 output: [1, 84, 8400] where 84 = 4 (bbox) + 1 (conf) + 80 (classes)
  // But for segmentation, output is different

  try {
    // Get output tensor (try different possible names)
    let outputTensor = outputs.output || outputs.outputs || outputs['output0'];

    if (!outputTensor) {
      // Get first output if no named output
      const firstKey = Object.keys(outputs)[0];
      outputTensor = outputs[firstKey];
    }

    if (!outputTensor) {
      console.error('No output tensor found');
      return detections;
    }

    const data = outputTensor.data;
    const dims = outputTensor.dims;

    console.log('Output dimensions:', dims);
    console.log('Output data length:', data.length);

    // TODO: Parse based on actual output format
    // For now, return empty array
    return detections;

  } catch (error) {
    console.error('Postprocess error:', error);
    return detections;
  }
};
  // ============================================
  // Draw segmentation masks on canvas
  // ============================================
  const drawMasks = (ctx, detections) => {
    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox;
      const width = (x2 - x1) * 640;
      const height = (y2 - y1) * 640;
      const px = x1 * 640;
      const py = y1 * 640;

      // Draw semi-transparent mask
      ctx.fillStyle = det.color + '80'; // Add 80 for 50% opacity
      ctx.fillRect(px, py, width, height);

      // Draw border
      ctx.strokeStyle = det.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, width, height);

      // Draw label background
      const label = `${det.class} ${(det.confidence * 100).toFixed(1)}%`;
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = det.color;
      ctx.fillRect(px, py - 20, textWidth + 10, 20);

      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, px + 5, py - 5);
    }
  };

  return (
    <div className="segmentation-container">
      <canvas ref={canvasRef} className="segmentation-canvas" />
      <div className="legend">
        <h3>Легенда</h3>
        {classNames.map(className => (
          <div key={className} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: classColors[className] }}
            />
            <span className="legend-label">{className}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SegmentationCanvas;