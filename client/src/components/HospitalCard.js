import React from 'react';
import './HospitalCard.css';

function HospitalCard({ hospital, onShowDoctors }) {
    const availableCount = hospital.doctors?.filter(d => d.status === 'available').length || 0;
    const busyCount = hospital.doctors?.filter(d => d.status === 'busy').length || 0;
    const leaveCount = hospital.doctors?.filter(d => d.status === 'leave').length || 0;
    
    const hospitalStatus = availableCount > 0 ? 'उपलब्ध' : 'छुट्टी पर';

    return (
        <div className="hospital-card">
            <div className="hospital-header">
                <div className="hospital-title">
                    <span className="hospital-icon">🏥</span>
                    <div className="hospital-info">
                        <h3>{hospital.name}</h3>
                    </div>
                </div>
                <span className="hospital-badge">{hospitalStatus}</span>
            </div>
            
            <div className="hospital-details">
                <div className="hospital-detail-item">
                    <i className="fas fa-map-marker-alt"></i>
                    <span className="label">City:</span>
                    <span>{hospital.location}</span>
                </div>
                <div className="hospital-detail-item">
                    <i className="fas fa-building"></i>
                    <span className="label">Type:</span>
                    <span>{hospital.type || 'GOV'}</span>
                </div>
            </div>
            
            <div className="total-doctors">
                Total Doctors: <strong>{hospital.total_doctors || hospital.doctors?.length || 0}</strong>
            </div>
            
            <div className="status-boxes">
                <div className="status-box">
                    <div className="status-box-header">
                        <span className="status-dot available"></span>
                        <span className="status-box-label">उपलब्ध</span>
                    </div>
                    <div className="status-box-count">{availableCount}</div>
                    <button 
                        className="status-box-btn available-btn"
                        onClick={() => onShowDoctors(hospital, 'available')}
                    ></button>
                </div>
                <div className="status-box">
                    <div className="status-box-header">
                        <span className="status-dot busy"></span>
                        <span className="status-box-label">व्यस्त</span>
                    </div>
                    <div className="status-box-count">{busyCount}</div>
                    <button 
                        className="status-box-btn busy-btn"
                        onClick={() => onShowDoctors(hospital, 'busy')}
                    ></button>
                </div>
                <div className="status-box">
                    <div className="status-box-header">
                        <span className="status-dot leave"></span>
                        <span className="status-box-label">छुट्टी पर</span>
                    </div>
                    <div className="status-box-count">{leaveCount}</div>
                    <button 
                        className="status-box-btn leave-btn"
                        onClick={() => onShowDoctors(hospital, 'leave')}
                    ></button>
                </div>
            </div>
        </div>
    );
}

export default HospitalCard;
