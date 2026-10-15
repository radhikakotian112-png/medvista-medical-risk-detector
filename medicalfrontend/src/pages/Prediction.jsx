import React, { useState } from 'react';
import { predictRisk, getModelStatus } from '../api';
import '../pages/Prediction.css';

export default function Prediction() {
  const [formData, setFormData] = useState({
    age: 45,
    fever_temp: 98.6,
    cough_days: 0,
    shortness_of_breath: 0,
    chest_pain: 0,
    fatigue: 0,
    oxygen_saturation: 98,
    respiratory_rate: 16,
    heart_rate: 72,
    blood_pressure_systolic: 120,
    smoker: 0,
    diabetes: 0,
    hypertension: 0,
    previous_infections: 0,
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelReady, setModelReady] = useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const checkModel = async () => {
      try {
        const status = await getModelStatus();
        if (isMounted) setModelReady(status.model_loaded);
      } catch (err) {
        if (!isMounted) return;
        setModelReady(false);
        setError(err.message || 'Could not check prediction model status.');
      }
    };

    checkModel();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : parseInt(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await predictRisk(formData);
      setPrediction(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score >= 75) return '#d32f2f';
    if (score >= 50) return '#f57c00';
    return '#388e3c';
  };

  if (!modelReady) {
    return (
      <div className="prediction-container">
        <div className="model-warning">
          <h2>Model Not Ready</h2>
          <p role={error ? 'alert' : undefined}>
            {error || 'The prediction model needs to be trained first. Run: python train_model.py'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="prediction-container">
      <div className="prediction-header">
        <h1>Medical Risk Predictor</h1>
        <p>AI-powered diagnosis support</p>
      </div>

      <div className="prediction-content">
        <div className="prediction-form-section">
          <h2>Patient Data</h2>
          <form onSubmit={handleSubmit} className="prediction-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Age</label>
                <input type="number" name="age" value={formData.age} onChange={handleChange} min="18" max="120" />
              </div>

              <div className="form-group">
                <label>Temperature (°F)</label>
                <input type="number" name="fever_temp" value={formData.fever_temp} onChange={handleChange} min="95" max="106" step="0.1" />
              </div>

              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input type="number" name="heart_rate" value={formData.heart_rate} onChange={handleChange} min="30" max="200" />
              </div>

              <div className="form-group">
                <label>Blood Pressure (mmHg)</label>
                <input type="number" name="blood_pressure_systolic" value={formData.blood_pressure_systolic} onChange={handleChange} min="60" max="250" />
              </div>

              <div className="form-group">
                <label>Oxygen Saturation (%)</label>
                <input type="number" name="oxygen_saturation" value={formData.oxygen_saturation} onChange={handleChange} min="50" max="100" step="0.1" />
              </div>

              <div className="form-group">
                <label>Respiratory Rate</label>
                <input type="number" name="respiratory_rate" value={formData.respiratory_rate} onChange={handleChange} min="8" max="50" />
              </div>

              <div className="form-group">
                <label>Cough Days</label>
                <input type="number" name="cough_days" value={formData.cough_days} onChange={handleChange} min="0" max="30" />
              </div>

              <div className="form-group">
                <label>Chest Pain (0-10)</label>
                <input type="number" name="chest_pain" value={formData.chest_pain} onChange={handleChange} min="0" max="10" />
              </div>

              <div className="checkbox-group">
                <label>
                  <input type="checkbox" checked={formData.shortness_of_breath === 1} onChange={(e) => setFormData(prev => ({ ...prev, shortness_of_breath: e.target.checked ? 1 : 0 }))} />
                  Shortness of Breath
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input type="checkbox" checked={formData.fatigue === 1} onChange={(e) => setFormData(prev => ({ ...prev, fatigue: e.target.checked ? 1 : 0 }))} />
                  Fatigue
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input type="checkbox" checked={formData.smoker === 1} onChange={(e) => setFormData(prev => ({ ...prev, smoker: e.target.checked ? 1 : 0 }))} />
                  Smoker
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input type="checkbox" checked={formData.diabetes === 1} onChange={(e) => setFormData(prev => ({ ...prev, diabetes: e.target.checked ? 1 : 0 }))} />
                  Diabetes
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input type="checkbox" checked={formData.hypertension === 1} onChange={(e) => setFormData(prev => ({ ...prev, hypertension: e.target.checked ? 1 : 0 }))} />
                  Hypertension
                </label>
              </div>

              <div className="form-group">
                <label>Previous Infections</label>
                <input type="number" name="previous_infections" value={formData.previous_infections} onChange={handleChange} min="0" max="10" />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="prediction-submit-btn">
              {loading ? 'Analyzing...' : 'Generate Prediction'}
            </button>
          </form>
        </div>

        {prediction && (
          <div className="prediction-results-section">
            <h2>Results</h2>
            
            <div className="risk-card" style={{ borderLeftColor: getRiskColor(prediction.risk_score) }}>
              <div className="risk-header">
                <h3>Diagnosis</h3>
                <div className="risk-score" style={{ backgroundColor: getRiskColor(prediction.risk_score) }}>
                  {prediction.risk_score}%
                </div>
              </div>
              <p>{prediction.primary_diagnosis}</p>
              <p>Confidence: {prediction.confidence}%</p>
            </div>

            <div className="recommendation-card">
              <h3>Recommendation</h3>
              <p>{prediction.recommendation}</p>
            </div>

            <div className="diagnoses-card">
              <h3>Possible Diagnoses</h3>
              <div className="diagnoses-list">
                {prediction.all_diagnoses.map((diag, idx) => (
                  <div key={idx} className="diagnosis-item">
                    <span>{diag.diagnosis}</span>
                    <div className="probability-bar">
                      <div className="probability-fill" style={{ width: `${diag.probability}%` }} />
                    </div>
                    <span>{diag.probability.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="factors-card">
              <h3>Top Factors</h3>
              <div className="factors-list">
                {prediction.top_factors.map((factor, idx) => (
                  <div key={idx} className="factor-item">
                    <span>#{idx + 1}</span>
                    <span>{factor.factor}</span>
                    <span>{(factor.importance * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="disclaimer">
              <p>Disclaimer: For clinical support only. Consult healthcare providers.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}