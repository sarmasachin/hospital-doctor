import React from 'react';
import './Footer.css';

function Footer() {
    return (
        <>
            <footer className="footer" id="contact">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-col">
                            <div className="footer-logo">
                                <i className="fas fa-hospital"></i>
                                <span>LiveHospital</span>
                            </div>
                            <p>हम आपको सबसे सटीक और अपडेटेड डॉक्टर उपलब्धता की जानकारी प्रदान करते हैं।</p>
                            <div className="social-links">
                                <a href="#"><i className="fab fa-facebook-f"></i></a>
                                <a href="#"><i className="fab fa-twitter"></i></a>
                                <a href="#"><i className="fab fa-instagram"></i></a>
                                <a href="#"><i className="fab fa-linkedin-in"></i></a>
                            </div>
                        </div>
                        <div className="footer-col">
                            <h4>त्वरित लिंक</h4>
                            <ul>
                                <li><a href="#">होम</a></li>
                                <li><a href="#hospitals">हॉस्पिटल</a></li>
                                <li><a href="#">डॉक्टर खोजें</a></li>
                            </ul>
                        </div>
                        <div className="footer-col">
                            <h4>सेवाएं</h4>
                            <ul>
                                <li><a href="#">अपॉइंटमेंट बुक करें</a></li>
                                <li><a href="#">ऑनलाइन परामर्श</a></li>
                                <li><a href="#">हेल्थ चेकअप</a></li>
                            </ul>
                        </div>
                        <div className="footer-col">
                            <h4>संपर्क करें</h4>
                            <div className="contact-info">
                                <p><i className="fas fa-envelope"></i> support@livehospital.org</p>
                                <p><i className="fas fa-envelope"></i> privacy@livehospital.org</p>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            <div className="sub-footer">
                <div className="container">
                    <div className="sub-footer-content">
                        <p>&copy; 2026 LiveHospital. सभी अधिकार सुरक्षित।</p>
                        <div className="sub-footer-links">
                            <a href="#">गोपनीयता नीति</a>
                            <a href="#">नियम और शर्तें</a>
                            <a href="#">कुकी नीति</a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Footer;
