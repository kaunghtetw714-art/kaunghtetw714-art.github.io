import React, { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import SegmentationCanvas from './components/SegmentationCanvas';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [segmentationResult, setSegmentationResult] = useState(null);

  return (
    <div className="App">
      <header>
        <h1>YOLOv8 Segmentation</h1>
        <p>Кафе / Ресторан / Столовая</p>
      </header>

      <ImageUploader onImageUpload={setImage} />

      {image && (
        <SegmentationCanvas
          image={image}
          modelPath="/models/best.onnx"
          onResult={setSegmentationResult}
        />
      )}

      {segmentationResult && segmentationResult.length > 0 && (
        <div className="results">
          <h2>Результаты сегментации</h2>
          {segmentationResult.map((obj, idx) => (
            <div key={idx} className="result-card">
              <span
                className="class-badge"
                style={{ backgroundColor: obj.color }}
              />
              <span className="class-name">{obj.class}</span>
              <span className="confidence">{(obj.confidence * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;