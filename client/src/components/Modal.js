import React from 'react';
import './Modal.css';

function Modal({ hospital, status, doctors, onClose, onUpdateStatus }) {
    if (!hospital || !doctors) return null;
    const doctorsList = Array.isArray(doctors) ? doctors : [];
    const statusLabels = {
        'available': 'उपलब्ध डॉक्टर',
        'busy': 'व्यस्त डॉक्टर',
        'leave': 'छुट्टी पर डॉक्टर'
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'available': return 'status-available';
            case 'busy': return 'status-busy';
            case 'leave': return 'status-leave';
            default: return '';
        }
    };

    const getStatusText = (status) => {
        switch(status) {
            case 'available': return 'उपलब्ध';
            case 'busy': return 'व्यस्त';
            case 'leave': return 'छुट्टी पर';
            default: return status;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <span className="close-modal" onClick={onClose}>&times;</span>
                
                <h2>{hospital.name}</h2>
                <p className="modal-location">
                    <i className="fas fa-map-marker-alt"></i> {hospital.location}
                </p>
                <p className="modal-status-label">
                    <span className={`status-badge ${getStatusClass(status)}`}>
                        {statusLabels[status]} ({doctorsList.length})
                    </span>
                </p>

                <div className="doctors-list">
                    {doctorsList.length > 0 ? (
                        doctorsList.map(doctor => (
                            <div key={doctor.id} className="doctor-item">
                                <div className="doctor-info">
                                    <div className="doctor-avatar">
                                        {(doctor.name || '').charAt(0)}
                                    </div>
                                    <div className="doctor-details">
                                        <h5>{doctor.name}</h5>
                                        <p>{doctor.specialty}</p>
                                        <small>{(doctor.timing || '')} | {(doctor.fees || '')}</small>
                                    </div>
                                </div>
                                <span className={`doctor-status ${getStatusClass(doctor.status)}`}>
                                    {getStatusText(doctor.status)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="no-doctors">
                            <i className="fas fa-user-slash"></i>
                            <p>इस श्रेणी में कोई डॉक्टर नहीं है</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Modal;
