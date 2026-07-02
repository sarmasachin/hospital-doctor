import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import Hero from './components/Hero';
import HospitalCard from './components/HospitalCard';
import Footer from './components/Footer';
import Modal from './components/Modal';
import './App.css';

function App() {
    const [hospitals, setHospitals] = useState([]);
    const [filteredHospitals, setFilteredHospitals] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [doctors, setDoctors] = useState([]);

    // Fetch hospitals with doctors
    useEffect(() => {
        fetchHospitals();
    }, []);

    const fetchHospitals = async () => {
        try {
            const hospitalsRes = await axios.get('/api/hospitals');
            const hospitalsData = hospitalsRes.data;

            // Fetch doctors for each hospital
            const hospitalsWithDoctors = await Promise.all(
                hospitalsData.map(async (hospital) => {
                    const doctorsRes = await axios.get(`/api/hospitals/${hospital.id}/doctors`);
                    return { ...hospital, doctors: doctorsRes.data };
                })
            );

            setHospitals(hospitalsWithDoctors);
            setFilteredHospitals(hospitalsWithDoctors);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    // Search hospitals
    const handleSearch = (term) => {
        setSearchTerm(term);
        if (!term) {
            setFilteredHospitals(hospitals);
            return;
        }
        const filtered = hospitals.filter(hospital => 
            (hospital.name || '').toLowerCase().includes(term.toLowerCase()) ||
            (hospital.location || '').toLowerCase().includes(term.toLowerCase()) ||
            (hospital.doctors || []).some(doc => 
                (doc.name || '').toLowerCase().includes(term.toLowerCase()) ||
                (doc.specialty || '').toLowerCase().includes(term.toLowerCase())
            )
        );
        setFilteredHospitals(filtered);
    };

    // Show doctors by status
    const showDoctorsByStatus = (hospital, status) => {
        setSelectedHospital(hospital);
        setSelectedStatus(status);
        const filteredDoctors = (hospital.doctors || []).filter(doc => doc.status === status);
        setDoctors(filteredDoctors);
        setModalOpen(true);
    };

    // Close modal
    const closeModal = () => {
        setModalOpen(false);
        setSelectedHospital(null);
        setSelectedStatus(null);
        setDoctors([]);
    };

    // Update doctor status
    const updateDoctorStatus = async (doctorId, newStatus) => {
        try {
            await axios.patch(`/api/doctors/${doctorId}/status`, { status: newStatus });
            fetchHospitals(); // Refresh data
            closeModal();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    return (
        <div className="App">
            <Header />
            <Hero searchTerm={searchTerm} onSearch={handleSearch} />
            
            <section className="hospitals-section" id="hospitals">
                <div className="container">
                    {loading ? (
                        <div className="loading">
                            <i className="fas fa-spinner fa-spin"></i>
                            <p>Loading...</p>
                        </div>
                    ) : (
                        <div className="hospitals-grid">
                            {filteredHospitals.length > 0 ? (
                                filteredHospitals.map(hospital => (
                                    <HospitalCard 
                                        key={hospital.id} 
                                        hospital={hospital}
                                        onShowDoctors={showDoctorsByStatus}
                                    />
                                ))
                            ) : (
                                <div className="no-results">
                                    <i className="fas fa-search"></i>
                                    <h3>कोई परिणाम नहीं मिला</h3>
                                    <p>कृपया अलग खोज शब्द आज़माएं</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <Footer />

            {modalOpen && (
                <Modal 
                    hospital={selectedHospital}
                    status={selectedStatus}
                    doctors={doctors}
                    onClose={closeModal}
                    onUpdateStatus={updateDoctorStatus}
                />
            )}
        </div>
    );
}

export default App;
